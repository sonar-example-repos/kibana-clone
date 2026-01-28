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
  AutocompleteToken,
  AutocompleteTerm,
  ResultTerm,
} from '../types';

import { SharedComponent } from './shared_component';

type ListGenerator = (
  context?: AutoCompleteContext,
  editor?: AutocompleteEditor
) => AutocompleteTerm[];

/** A component that suggests one of the given options, but accepts anything (when configured). */
export class ListComponent extends SharedComponent {
  listGenerator: ListGenerator;
  multiValued: boolean;
  allowNonValidValues: boolean;

  constructor(
    name: string,
    list: AutocompleteTerm[] | ListGenerator,
    parent?: SharedComponent,
    multiValued?: boolean,
    allowNonValidValues?: boolean
  ) {
    super(name, parent);

    this.listGenerator = Array.isArray(list) ? () => list : list;
    this.multiValued = _.isUndefined(multiValued) ? true : multiValued;
    this.allowNonValidValues = _.isUndefined(allowNonValidValues) ? false : allowNonValidValues;
  }

  override getTerms(context: AutoCompleteContext, editor: AutocompleteEditor): AutocompleteTerm[] {
    if (!this.multiValued && context.otherTokenValues) {
      // already have a value -> no suggestions
      return [];
    }

    const alreadySetValues = toStringArray(context.otherTokenValues);
    const alreadySetTerms: AutocompleteTerm[] = alreadySetValues;

    let ret = _.difference(this.listGenerator(context, editor), alreadySetTerms);

    const defaultMeta = this.getDefaultTermMeta();
    if (defaultMeta) {
      ret = _.map(ret, (term) => {
        if (typeof term === 'string') {
          const t: ResultTerm = { name: term };
          return _.defaults(t, { meta: defaultMeta });
        }

        if (term === null || typeof term === 'boolean' || typeof term === 'number') {
          const t: ResultTerm = { name: term };
          return _.defaults(t, { meta: defaultMeta });
        }

        // object term
        return _.defaults(term, { meta: defaultMeta });
      });
    }

    return ret;
  }

  validateTokens(tokens: string[]): boolean {
    if (!this.multiValued && tokens.length > 1) {
      return false;
    }

    // verify we have all tokens
    const list = this.listGenerator();
    const listStrings = list.filter((t): t is string => typeof t === 'string');

    const notFound = _.some(tokens, (token) => listStrings.indexOf(token) === -1);
    return !notFound;
  }

  getContextKey(): string {
    return this.name;
  }

  getDefaultTermMeta(): string {
    return this.name;
  }

  override match(
    token: AutocompleteToken,
    context: AutoCompleteContext,
    editor: AutocompleteEditor
  ): AutocompleteMatch {
    const tokens = toTokenStrings(token);
    if (!this.allowNonValidValues && !this.validateTokens(tokens)) {
      return null;
    }

    const base = super.match(tokens, context, editor);
    if (!base) {
      return base;
    }

    const result: AutocompleteMatchResult = base;
    result.context_values ??= {};
    result.context_values[this.getContextKey()] = tokens;

    return result;
  }
}

function toTokenStrings(value: AutocompleteToken): string[] {
  if (typeof value === 'string') {
    return [value];
  }

  return value;
}

function toStringArray(value: unknown): string[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string');
  }

  if (typeof value === 'string') {
    return [value];
  }

  return [];
}
