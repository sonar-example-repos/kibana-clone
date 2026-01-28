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
  AutocompleteTerm,
  ResultTerm,
} from './types';
import type { SharedComponent } from './components';
import { ConstantComponent } from './components';

export class ParamComponent extends ConstantComponent {
  description: unknown;

  constructor(name: string, parent: SharedComponent, description: unknown) {
    super(name, parent);
    this.description = description;
  }

  override getTerms(
    _context: AutoCompleteContext,
    _editor: AutocompleteEditor
  ): AutocompleteTerm[] {
    const term: ResultTerm = { name: this.name };
    if (this.description === '__flag__') {
      term.meta = 'flag';
    } else {
      term.meta = 'param';
      term.insertValue = `${this.name}=`;
    }

    return [term];
  }
}
