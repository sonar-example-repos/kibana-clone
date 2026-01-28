/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import _ from 'lodash';

import { getAutocompleteInfo, ENTITIES } from '../../../services';
import { ListComponent } from './list_component';
import type { SharedComponent } from './shared_component';
import type { AutoCompleteContext, ResultTerm } from '../types';
import type { Field } from '../../autocomplete_entities/types';
import { isRecord } from '../../../../common/utils/record_utils';

function fieldGenerator(context?: AutoCompleteContext): ResultTerm[] {
  const ctx: AutoCompleteContext = context ?? {};
  const maybeFields = getAutocompleteInfo().getEntityProvider(ENTITIES.FIELDS, ctx);

  if (!Array.isArray(maybeFields) || !maybeFields.every(isField)) {
    return [];
  }

  return _.map(maybeFields, (field) => ({ name: field.name, meta: field.type }));
}

export class FieldAutocompleteComponent extends ListComponent {
  constructor(name: string, parent: SharedComponent | undefined, multiValued: boolean) {
    super(name, fieldGenerator, parent, multiValued);
  }

  override validateTokens(tokens: string[]): boolean {
    if (!this.multiValued && tokens.length > 1) {
      return false;
    }

    return !_.find(tokens, (token) => /[^\w.?*]/.test(token));
  }

  override getDefaultTermMeta(): string {
    return 'field';
  }

  override getContextKey(): string {
    return 'fields';
  }
}

function isField(value: unknown): value is Field {
  if (!isRecord(value)) return false;
  return typeof value.name === 'string' && typeof value.type === 'string';
}
