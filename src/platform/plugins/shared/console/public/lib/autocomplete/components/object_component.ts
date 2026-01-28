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
  AutocompleteTerm,
  AutocompleteToken,
} from '../types';

import { SharedComponent } from './shared_component';

/**
 * @param constants list of components that represent constant keys
 * @param patternsAndWildCards list of components that represent patterns and should be matched only if
 * there are no constant matches
 */
export class ObjectComponent extends SharedComponent {
  constants: AutocompleteComponentLike[];
  patternsAndWildCards: AutocompleteComponentLike[];

  constructor(
    name: string,
    constants: AutocompleteComponentLike[],
    patternsAndWildCards: AutocompleteComponentLike[]
  ) {
    super(name);
    this.constants = constants;
    this.patternsAndWildCards = patternsAndWildCards;
  }

  override getTerms(context: AutoCompleteContext, editor: AutocompleteEditor): AutocompleteTerm[] {
    const options: AutocompleteTerm[] = [];

    _.each(this.constants, (component) => {
      options.push.apply(options, component.getTerms(context, editor) as AutocompleteTerm[]);
    });

    _.each(this.patternsAndWildCards, (component) => {
      options.push.apply(options, component.getTerms(context, editor) as AutocompleteTerm[]);
    });

    return options;
  }

  override match(
    token: AutocompleteToken,
    context: AutoCompleteContext,
    editor: AutocompleteEditor
  ): AutocompleteMatch {
    const result: AutocompleteMatchResult = { next: [] };

    _.each(this.constants, (component) => {
      const componentResult = component.match(token, context, editor);
      if (componentResult && componentResult.next) {
        result.next.push(...componentResult.next);
      }
    });

    // try to link to GLOBAL rules
    const globalRules = context.globalComponentResolver!(token as unknown as string, false);
    if (globalRules) {
      result.next.push(...globalRules);
    }

    if (result.next.length) {
      return result;
    }

    _.each(this.patternsAndWildCards, (component) => {
      const componentResult = component.match(token, context, editor);
      if (componentResult && componentResult.next) {
        result.next.push(...componentResult.next);
      }
    });

    return result;
  }
}
