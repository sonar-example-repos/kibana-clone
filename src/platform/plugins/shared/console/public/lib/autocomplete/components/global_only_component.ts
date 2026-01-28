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
  AutocompleteTerm,
} from '../types';

import { SharedComponent } from './shared_component';

export class GlobalOnlyComponent extends SharedComponent {
  override getTerms(
    _context: AutoCompleteContext,
    _editor: AutocompleteEditor
  ): AutocompleteTerm[] | null {
    return null;
  }

  override match(
    token: AutocompleteToken,
    context: AutoCompleteContext,
    _editor: AutocompleteEditor
  ): AutocompleteMatch {
    const result: AutocompleteMatchResult = { next: [] };

    // try to link to GLOBAL rules
    const globalRules = context.globalComponentResolver!(
      Array.isArray(token) ? token.join(',') : token,
      false
    );
    if (globalRules) {
      result.next.push(...globalRules);
    }

    if (result.next.length) {
      return result;
    }

    // just loop back to us
    result.next = [this];

    return result;
  }
}
