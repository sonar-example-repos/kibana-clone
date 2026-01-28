/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import _ from 'lodash';

import type { AutocompleteComponentLike } from '../types';

import { AutocompleteComponent } from './autocomplete_component';

export class SharedComponent extends AutocompleteComponent {
  _nextDict: Record<string, AutocompleteComponentLike[]> = {};

  constructor(name: string, parent?: SharedComponent) {
    super(name);

    if (parent) {
      parent.addComponent(this);
    }
  }

  /** Return the first component with a given name. */
  getComponent(name: string): AutocompleteComponentLike | undefined {
    const list = this._nextDict[name];
    return list ? list[0] : undefined;
  }

  addComponent(component: AutocompleteComponentLike): void {
    const current = this._nextDict[component.name] ?? [];
    current.push(component);
    this._nextDict[component.name] = current;

    this.next = ([] as AutocompleteComponentLike[]).concat.apply([], _.values(this._nextDict));
  }
}
