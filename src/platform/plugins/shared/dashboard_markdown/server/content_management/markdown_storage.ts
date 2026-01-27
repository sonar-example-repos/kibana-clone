/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { SavedObject } from '@kbn/core/server';

import type {
  ContentStorage,
  MSearchConfig,
  StorageContext,
} from '@kbn/content-management-plugin/server';
import { MARKDOWN_SAVED_OBJECT_TYPE } from '../../common/constants';
import type { MarkdownState } from '.';
import type { MarkdownItem } from '../../common/content_management';
import type { StoredMarkdownState } from '.';
import { savedObjectToItem } from '.';

export class MarkdownStorage implements ContentStorage<MarkdownState> {
  public async get(id: string): Promise<MarkdownState> {
    throw new Error('Get not implemented.');
  }
  public async bulkGet(ctx: StorageContext, ids: string[], options?: object): Promise<{}> {
    throw new Error('Bulk get not implemented.');
  }
  public async create(data: MarkdownState): Promise<{ id: string; data: MarkdownState }> {
    throw new Error('Create not implemented.');
  }
  public async update(id: string, data: MarkdownState): Promise<MarkdownState> {
    throw new Error('Update not implemented.');
  }
  public async delete(id: string): Promise<void> {
    throw new Error('Delete not implemented.');
  }
  public async search(query: string): Promise<Array<{ id: string; data: MarkdownState }>> {
    throw new Error('Search not implemented.');
  }

  // TODO: Remove in the future at part of content management clean up
  // only required for populating SavedObjectFinder in AddFromLibrary flyout
  mSearch: MSearchConfig<MarkdownState> = {
    savedObjectType: MARKDOWN_SAVED_OBJECT_TYPE,
    toItemResult: (
      ctx: StorageContext,
      savedObject: SavedObject<StoredMarkdownState>
    ): MarkdownItem => savedObjectToItem(savedObject) as MarkdownItem,
  };
}
