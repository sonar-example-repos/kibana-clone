/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type {
  AutoCompleteContext,
  AutocompleteEditor,
  AutocompleteComponentLike,
  AutocompleteMatch,
  AutocompleteTerm,
  AutocompleteToken,
} from '../types';

import { SharedComponent } from './shared_component';

type Predicate = (context: AutoCompleteContext, editor: AutocompleteEditor) => boolean;

export class ConditionalProxy extends SharedComponent {
  predicate: Predicate;
  delegate: AutocompleteComponentLike;

  constructor(predicate: Predicate, delegate: AutocompleteComponentLike) {
    super('__condition');
    this.predicate = predicate;
    this.delegate = delegate;
  }

  override getTerms(
    context: AutoCompleteContext,
    editor: AutocompleteEditor
  ): AutocompleteTerm[] | null {
    return this.predicate(context, editor) ? this.delegate.getTerms(context, editor) : null;
  }

  override match(
    token: AutocompleteToken,
    context: AutoCompleteContext,
    editor: AutocompleteEditor
  ): AutocompleteMatch {
    return this.predicate(context, editor) ? this.delegate.match(token, context, editor) : false;
  }
}
