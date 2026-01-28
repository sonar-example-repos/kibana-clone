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
  AutocompleteMatch,
  AutocompleteMatchResult,
  AutocompleteComponentLike,
  ResultTerm,
  AutocompleteToken,
} from './types';

declare global {
  interface Window {
    engine_trace?: boolean;
  }
}

export function wrapComponentWithDefaults<T extends AutocompleteComponentLike>(
  component: T,
  defaults: Partial<ResultTerm>
): T {
  const originalGetTerms = component.getTerms;

  component.getTerms = function (context: AutoCompleteContext, editor: AutocompleteEditor) {
    const terms = originalGetTerms.call(component, context, editor);
    if (!terms) return terms;

    return _.map(terms, (term) => {
      if (!_.isObject(term)) {
        term = { name: term };
      }

      // `_.defaults()` mutates and fills missing values.
      return _.defaults(term as ResultTerm, defaults);
    });
  };

  return component;
}

const tracer = function (...args: unknown[]) {
  if (window.engine_trace) {
    // eslint-disable-next-line no-console
    console.log.call(console, ...args);
  }
};

function passThroughContext(
  context: AutoCompleteContext,
  extensionList?: Array<Record<string, unknown>>
): AutoCompleteContext {
  const result = Object.create(context) as AutoCompleteContext;

  if (extensionList) {
    _.assign(result, ...extensionList);
  }

  return result;
}

export class WalkingState {
  constructor(
    public parentName: string,
    public components: AutocompleteComponentLike[] | undefined,
    public contextExtensionList: Array<Record<string, unknown>>,
    public depth: number = 0,
    public priority?: number
  ) {}
}

export type TokenPathToken = AutocompleteToken;

export function walkTokenPath(
  tokenPath: TokenPathToken[],
  walkingStates: WalkingState[],
  context: AutoCompleteContext,
  editor: AutocompleteEditor
): WalkingState[] {
  if (!tokenPath || tokenPath.length === 0) {
    return walkingStates;
  }

  const token = tokenPath[0];
  const nextWalkingStates: WalkingState[] = [];

  tracer(`starting token evaluation [${token}]`);

  for (const ws of walkingStates) {
    const contextForState = passThroughContext(context, ws.contextExtensionList);

    for (const component of ws.components ?? []) {
      tracer(`evaluating [${token}] with [${component.name}]`, component);
      const result = component.match(token, contextForState, editor);

      if (isMatchResult(result)) {
        tracer(`matched [${token}] with:`, result);

        let next: AutocompleteComponentLike[] | undefined;
        if (result.next && !Array.isArray(result.next)) {
          next = [result.next];
        } else {
          next = result.next;
        }
        const extensionList = result.context_values
          ? [...ws.contextExtensionList, result.context_values]
          : ws.contextExtensionList;

        const priority = mergePriority(ws.priority, result.priority);

        nextWalkingStates.push(
          new WalkingState(component.name, next, extensionList, ws.depth + 1, priority)
        );
      }
    }
  }

  if (nextWalkingStates.length === 0) {
    // nowhere to go, still return context variables returned so far
    return walkingStates.map((ws) => new WalkingState(ws.parentName, [], ws.contextExtensionList));
  }

  return walkTokenPath(tokenPath.slice(1), nextWalkingStates, context, editor);
}

export function populateContext(
  tokenPath: TokenPathToken[],
  context: AutoCompleteContext,
  editor: AutocompleteEditor,
  includeAutoComplete: boolean,
  components: AutocompleteComponentLike[] | undefined
): void {
  const walkStates = walkTokenPath(
    tokenPath,
    [new WalkingState('ROOT', components, [])],
    context,
    editor
  );

  if (includeAutoComplete) {
    const autoCompleteSet = new Map<ResultTerm['name'], ResultTerm>();

    for (const ws of walkStates) {
      const contextForState = passThroughContext(context, ws.contextExtensionList);

      for (const component of ws.components ?? []) {
        _.each(component.getTerms(contextForState, editor), (term) => {
          if (!_.isObject(term)) {
            term = { name: term };
          }

          const normalized = term as ResultTerm;

          if (!autoCompleteSet.has(normalized.name)) {
            autoCompleteSet.set(normalized.name, normalized);
          }
        });
      }
    }

    context.autoCompleteSet = Array.from(autoCompleteSet.values());
  }

  // Apply what values were set so far to context, selecting the deepest one which sets the context
  if (walkStates.length !== 0) {
    const sorted = _.sortBy(walkStates, (ws) =>
      typeof ws.priority === 'number' ? ws.priority : Number.MAX_VALUE
    );

    let wsToUse = sorted.find((ws) => !ws.components || ws.components.length === 0);

    if (!wsToUse && walkStates.length > 1 && !includeAutoComplete) {
      // eslint-disable-next-line no-console
      console.info(
        "more than one context active for current path, but autocomplete isn't requested",
        walkStates
      );
    }

    if (!wsToUse) {
      wsToUse = sorted[0];
    }

    _.each(wsToUse.contextExtensionList, (extension) => {
      _.assign(context, extension);
    });
  }
}

function isMatchResult(result: AutocompleteMatch): result is AutocompleteMatchResult {
  if (!result) return false;
  return !_.isEmpty(result);
}

function mergePriority(current: number | undefined, next: number | undefined): number | undefined {
  if (typeof next !== 'number') return current;
  if (typeof current !== 'number') return next;
  return Math.min(current, next);
}
