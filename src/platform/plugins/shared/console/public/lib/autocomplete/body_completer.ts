/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import _ from 'lodash';

import type {
  AutoCompleteContext,
  AutocompleteEditor,
  AutocompleteComponentLike,
  AutocompleteTerm,
  AutocompleteToken,
  JsonValue,
  ResultTerm,
} from './types';

import { WalkingState, walkTokenPath, wrapComponentWithDefaults } from './engine';
import {
  ConditionalProxy,
  ConstantComponent,
  GlobalOnlyComponent,
  ObjectComponent,
  SharedComponent,
} from './components';

type Description = null | boolean | number | string | Description[] | Record<string, unknown>;

export type BodyDescription = Description;

type ScopeLink =
  | string
  | ((context: AutoCompleteContext, editor: AutocompleteEditor) => Description);

export interface ParametrizedComponentFactories {
  getComponent: (name: string) => ParametrizedComponentFactory | undefined;
}

type ParametrizedComponentFactory = (
  name: string,
  parent: SharedComponent | undefined,
  template?: JsonValue
) => SharedComponent;

interface CompilingContext {
  endpointId: string;
  parametrizedComponentFactories: ParametrizedComponentFactories;
}

function createCompilingContext(
  endpointId: string,
  parametrizedComponentFactories: ParametrizedComponentFactories
): CompilingContext {
  return { endpointId, parametrizedComponentFactories };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function resolvePathToComponents(
  tokenPath: string[],
  context: AutoCompleteContext,
  editor: AutocompleteEditor,
  components: AutocompleteComponentLike[] | undefined
): AutocompleteComponentLike[] {
  const walkStates = walkTokenPath(
    tokenPath,
    [new WalkingState('ROOT', components, [])],
    context,
    editor
  );
  // Flatten the walking-state component arrays into a single list.
  return ([] as AutocompleteComponentLike[]).concat.apply(
    [],
    _.map(walkStates, 'components') as unknown as AutocompleteComponentLike[][]
  );
}

class ScopeResolver extends SharedComponent {
  link: ScopeLink;
  compilingContext: CompilingContext;

  constructor(link: ScopeLink, compilingContext: CompilingContext) {
    super('__scope_link');

    if (_.isString(link) && link.startsWith('.')) {
      // relative link, inject current endpoint
      this.link =
        link === '.' ? compilingContext.endpointId : `${compilingContext.endpointId}${link}`;
    } else {
      this.link = link;
    }
    this.compilingContext = compilingContext;
  }

  resolveLinkToComponents(
    context: AutoCompleteContext,
    editor: AutocompleteEditor
  ): AutocompleteComponentLike[] {
    if (_.isFunction(this.link)) {
      const desc = this.link(context, editor);
      return compileDescription(desc, this.compilingContext);
    }

    if (!_.isString(this.link)) {
      throw new Error('unsupported link format');
    }

    let path = this.link.replace(/\./g, '{').split(/(\{)/);
    const endpoint = path[0];
    let components: AutocompleteComponentLike[] | undefined;
    try {
      if (endpoint === 'GLOBAL') {
        // global rules need an extra indirection
        if (path.length < 3) {
          throw new Error('missing term in global link: ' + this.link);
        }
        const term = path[2];
        components = context.globalComponentResolver!(term as string);
        path = path.slice(3);
      } else {
        path = path.slice(1);
        components = context.endpointComponentResolver!(endpoint);
      }
    } catch (e) {
      throw new Error('failed to resolve link [' + this.link + ']: ' + e);
    }

    return resolvePathToComponents(path, context, editor, components);
  }

  override getTerms(context: AutoCompleteContext, editor: AutocompleteEditor) {
    const options: AutocompleteTerm[] = [];
    for (const component of this.resolveLinkToComponents(context, editor)) {
      const terms = component.getTerms(context, editor);
      if (terms) options.push(...terms);
    }
    return options;
  }

  override match(
    token: AutocompleteToken,
    context: AutoCompleteContext,
    editor: AutocompleteEditor
  ) {
    const result: { next: AutocompleteComponentLike[] } = { next: [] };
    for (const component of this.resolveLinkToComponents(context, editor)) {
      const componentResult = component.match(token, context, editor);
      if (componentResult) {
        result.next.push(...componentResult.next);
      }
    }
    return result;
  }
}

function compileDescription(
  description: Description,
  compilingContext: CompilingContext
): SharedComponent[] {
  if (Array.isArray(description)) {
    return [compileList(description, compilingContext)];
  }

  if (isObject(description)) {
    const scopeLink = getScopeLink(description);
    if (scopeLink) {
      return [new ScopeResolver(scopeLink, compilingContext)];
    }

    const anyOf = getAnyOf(description);
    if (anyOf) {
      return [compileList(anyOf, compilingContext)];
    }

    const oneOf = getOneOf(description);
    if (oneOf) {
      const compiled: SharedComponent[] = [];
      for (const d of oneOf) {
        compiled.push(...compileDescription(d, compilingContext));
      }
      return compiled;
    }

    const obj = compileObject(description, compilingContext);
    const condition = getCondition(description);
    if (condition) {
      return [compileCondition(condition, obj)];
    }

    return [obj];
  }

  if (typeof description === 'string' && isParametrizedToken(description)) {
    return [compileParametrizedValue(description, compilingContext)];
  }

  return [compileLiteral(description)];
}

function compileLiteral(
  value: Exclude<Description, Description[] | Record<string, unknown>>
): ConstantComponent {
  const name = String(value);
  return new ConstantComponent(name, undefined, [value]);
}

function compileParametrizedValue(
  value: string,
  compilingContext: CompilingContext,
  template?: JsonValue
): SharedComponent {
  const lower = value.substring(1, value.length - 1).toLowerCase();
  const factory = compilingContext.parametrizedComponentFactories.getComponent(lower);

  if (!factory) {
    // eslint-disable-next-line no-console
    console.warn(`[Console] no factory found for '${lower}'`);
    // Using upper case as an indication that this value is a parameter.
    return new ConstantComponent(lower.toUpperCase());
  }

  let component = factory(lower, undefined, template);
  if (template !== undefined) {
    component = wrapComponentWithDefaults(component, { template });
  }

  return component;
}

function compileObject(
  objDescription: Record<string, unknown>,
  compilingContext: CompilingContext
): ConstantComponent {
  const objectC = new ConstantComponent('{');
  const constants: SharedComponent[] = [];
  const patterns: SharedComponent[] = [];

  for (const [key, desc] of Object.entries(objDescription)) {
    if (key.startsWith('__')) continue; // meta key

    const parsedDesc = asDescription(desc);
    const options = getOptions(parsedDesc);

    let component: SharedComponent;
    if (isParametrizedToken(key)) {
      component = compileParametrizedValue(key, compilingContext, options.template);
      patterns.push(component);
    } else if (key === '*') {
      component = new SharedComponent(key);
      patterns.push(component);
    } else {
      const optionTerm: ResultTerm = { name: key, template: options.template };
      component = new ConstantComponent(key, undefined, [optionTerm]);
      constants.push(component);
    }

    for (const subComponent of compileDescription(parsedDesc, compilingContext)) {
      component.addComponent(subComponent);
    }
  }

  objectC.addComponent(new ObjectComponent('inner', constants, patterns));
  return objectC;
}

function compileList(
  listRule: Description[],
  compilingContext: CompilingContext
): ConstantComponent {
  const listC = new ConstantComponent('[');
  for (const desc of listRule) {
    for (const component of compileDescription(desc, compilingContext)) {
      listC.addComponent(component);
    }
  }
  return listC;
}

function compileCondition(
  description: Record<string, unknown>,
  compiledObject: SharedComponent
): ConditionalProxy {
  if ((description as { lines_regex?: unknown }).lines_regex) {
    return new ConditionalProxy((context, editor) => {
      const lines = editor!
        .getLines(context.requestStartRow as number, editor!.getCurrentPosition().lineNumber)
        .join('\n');
      return new RegExp((description as { lines_regex: string }).lines_regex, 'm').test(lines);
    }, compiledObject);
  }

  throw new Error(`unknown condition type - got: ${JSON.stringify(description)}`);
}

// A list of components that match anything but give autocomplete suggestions based on global API entries.
export function globalsOnlyAutocompleteComponents(): SharedComponent[] {
  return [new GlobalOnlyComponent('__global__')];
}

export function compileBodyDescription(
  endpointId: string,
  description: BodyDescription,
  parametrizedComponentFactories: ParametrizedComponentFactories
): SharedComponent[] {
  return compileDescription(
    description,
    createCompilingContext(endpointId, parametrizedComponentFactories)
  );
}

function getOptions(description: Description): { template?: JsonValue } {
  const template = getTemplate(description);
  return template === undefined ? {} : { template };
}

function getTemplate(description: Description): JsonValue | undefined {
  if (Array.isArray(description)) {
    if (description.length === 1 && isObject(description[0])) {
      const innerTemplate = getTemplate(description[0]);
      return innerTemplate != null ? [innerTemplate] : [];
    }
    return [];
  }

  if (!isObject(description)) {
    if (typeof description === 'string' && !isParametrizedToken(description)) {
      return description;
    }
    return description;
  }

  if ('__template' in description) {
    const rawTemplate = description.__template;
    if (description.__raw && typeof rawTemplate === 'string') {
      return { __raw: true, value: rawTemplate };
    }
    return rawTemplate as JsonValue;
  }

  if (
    '__one_of' in description &&
    Array.isArray(description.__one_of) &&
    description.__one_of.length > 0
  ) {
    return getTemplate(asDescription(description.__one_of[0]));
  }

  if ('__any_of' in description) {
    return [];
  }

  if ('__scope_link' in description) {
    // assume an object for now
    const empty: { [key: string]: JsonValue } = {};
    return empty;
  }

  const empty: { [key: string]: JsonValue } = {};
  return empty;
}

function getScopeLink(description: Record<string, unknown>): ScopeLink | null {
  const link = description.__scope_link;
  if (typeof link === 'string') return link;
  if (isScopeLinkFunction(link)) return link;
  return null;
}

function isScopeLinkFunction(
  value: unknown
): value is (context: AutoCompleteContext, editor: AutocompleteEditor) => Description {
  return typeof value === 'function';
}

function getAnyOf(description: Record<string, unknown>): Description[] | null {
  const anyOf = description.__any_of;
  return Array.isArray(anyOf) ? anyOf.map(asDescription) : null;
}

function getOneOf(description: Record<string, unknown>): Description[] | null {
  const oneOf = description.__one_of;
  return Array.isArray(oneOf) ? oneOf.map(asDescription) : null;
}

function getCondition(description: Record<string, unknown>): Record<string, unknown> | null {
  const condition = description.__condition;
  return isObject(condition) ? condition : null;
}

function isParametrizedToken(value: string): boolean {
  return /^\{.*\}$/.test(value);
}

function asDescription(value: unknown): Description {
  if (Array.isArray(value)) return value.map(asDescription);
  if (isObject(value)) return value;
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null
  ) {
    return value;
  }
  // Unsupported types are treated as null to avoid throwing during compilation.
  return null;
}
