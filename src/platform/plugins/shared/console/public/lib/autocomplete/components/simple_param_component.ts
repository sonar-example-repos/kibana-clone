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
  AutocompleteMatch,
  AutocompleteMatchResult,
  AutocompleteToken,
} from '../types';

import { SharedComponent } from './shared_component';

export class SimpleParamComponent extends SharedComponent {
  override match(
    token: AutocompleteToken,
    context: AutoCompleteContext,
    editor: AutocompleteEditor
  ): AutocompleteMatch {
    const base = super.match(token, context, editor);
    if (!base) {
      return base;
    }

    const result: AutocompleteMatchResult = base;
    result.context_values ??= {};
    result.context_values[this.name] = token;

    return result;
  }
}
