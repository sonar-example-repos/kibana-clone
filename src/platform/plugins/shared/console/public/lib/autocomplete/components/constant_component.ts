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
  AutocompleteToken,
  AutocompleteTerm,
} from '../types';

import { SharedComponent } from './shared_component';

export class ConstantComponent extends SharedComponent {
  options: AutocompleteTerm[];

  constructor(
    name: string,
    parent?: SharedComponent,
    options?: AutocompleteTerm | AutocompleteTerm[]
  ) {
    super(name, parent);

    let normalized: AutocompleteTerm[];
    if (options === undefined) {
      normalized = [name];
    } else if (_.isString(options)) {
      normalized = [options];
    } else if (Array.isArray(options)) {
      normalized = options;
    } else if (options) {
      normalized = [options];
    } else {
      normalized = [name];
    }

    this.options = normalized;
  }

  override getTerms(
    _context: AutoCompleteContext,
    _editor: AutocompleteEditor
  ): AutocompleteTerm[] {
    return this.options;
  }

  addOption(options: AutocompleteTerm | AutocompleteTerm[]): void {
    const normalized = Array.isArray(options) ? options : [options];
    this.options = _.uniq([...this.options, ...normalized]);
  }

  override match(
    token: AutocompleteToken,
    context: AutoCompleteContext,
    editor: AutocompleteEditor
  ): AutocompleteMatch {
    if (typeof token !== 'string' || token !== this.name) {
      return null;
    }

    return super.match(token, context, editor);
  }
}
