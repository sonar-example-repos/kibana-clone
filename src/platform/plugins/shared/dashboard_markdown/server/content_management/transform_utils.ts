/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { SavedObject, SavedObjectReference } from '@kbn/core-saved-objects-api-server';
import type { Reference } from '@kbn/content-management-utils/src/types';
import type { MarkdownItem } from '../../common/content_management';
import type { MarkdownState, StoredMarkdownState } from './schema/v1';

type PartialSavedObject<T> = Omit<SavedObject<Partial<T>>, 'references'> & {
  references: SavedObjectReference[] | undefined;
};

interface PartialMarkdownItem {
  attributes: Partial<MarkdownItem['attributes']>;
  references: SavedObjectReference[] | undefined;
}

export function savedObjectToItem(
  savedObject: SavedObject<StoredMarkdownState> | PartialSavedObject<StoredMarkdownState>
): MarkdownItem | PartialMarkdownItem {
  const { references, attributes, ...rest } = savedObject;
  return {
    ...rest,
    attributes,
    references: (references ?? []).filter(({ type }) => type === 'tag'),
  };
}

export function itemToAttributes(state: MarkdownState): {
  attributes: StoredMarkdownState;
  references: Reference[];
} {
  return {
    attributes: state,
    references: [],
  };
}
