/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { TypeOf } from '@kbn/config-schema';
import type {
  CreateIn,
  CreateResult,
  DeleteIn,
  DeleteResult,
  GetIn,
  SearchIn,
  SearchResult,
  UpdateIn,
  UpdateResult,
} from '@kbn/content-management-plugin/common';
import type {
  SOWithMetadata,
  SOWithMetadataPartial,
  GetResultSO,
} from '@kbn/content-management-utils';

import type { MarkdownContentType } from '../../../../common/content_management';
import type {
  markdownCreateOptionsSchema,
  markdownSearchOptionsSchema,
  markdownUpdateOptionsSchema,
  markdownItemAttributesSchema,
} from './cm_services';

export type MarkdownState = TypeOf<typeof markdownItemAttributesSchema>;
export type StoredMarkdownState = MarkdownState;

export type MarkdownCreateOptions = TypeOf<typeof markdownCreateOptionsSchema>;
export type MarkdownUpdateOptions = TypeOf<typeof markdownUpdateOptionsSchema>;
export type MarkdownSearchOptions = TypeOf<typeof markdownSearchOptionsSchema>;

export type MarkdownAttributes = TypeOf<typeof markdownItemAttributesSchema>;
export type MarkdownItem = TypeOf<typeof markdownItemAttributesSchema>;

export type MarkdownSavedObject = SOWithMetadata<MarkdownAttributes>;
export type MarkdownPartialSavedObject = SOWithMetadataPartial<MarkdownAttributes>;

export type MarkdownGetIn = GetIn<MarkdownContentType>;
export type MarkdownGetOut = GetResultSO<MarkdownSavedObject>;

export type MarkdownCreateIn = CreateIn<
  MarkdownContentType,
  MarkdownAttributes,
  MarkdownCreateOptions
>;
export type MarkdownCreateOut = CreateResult<MarkdownSavedObject>;

// Need to handle Markdown UpdateIn a bit differently
export type MarkdownUpdateIn = UpdateIn<
  MarkdownContentType,
  MarkdownAttributes,
  MarkdownUpdateOptions
>;
export type MarkdownUpdateOut = UpdateResult<MarkdownPartialSavedObject>;

export type MarkdownDeleteIn = DeleteIn<MarkdownContentType>;
export type MarkdownDeleteOut = DeleteResult;

export type MarkdownSearchIn = SearchIn<MarkdownContentType, MarkdownSearchOptions>;
export type MarkdownSearchOut = SearchResult<MarkdownSavedObject>;

export interface MarkdownCrud {
  Attributes: MarkdownAttributes;
  Item: MarkdownSavedObject;
  PartialItem: MarkdownPartialSavedObject;
  GetIn: MarkdownGetIn;
  GetOut: MarkdownGetOut;
  CreateIn: MarkdownCreateIn;
  CreateOut: MarkdownCreateOut;
  CreateOptions: MarkdownCreateOptions;
  SearchIn: MarkdownSearchIn;
  SearchOut: MarkdownSearchOut;
  SearchOptions: MarkdownSearchOptions;
  UpdateIn: MarkdownUpdateIn;
  UpdateOut: MarkdownUpdateOut;
  UpdateOptions: MarkdownUpdateOptions;
  DeleteIn: MarkdownDeleteIn;
  DeleteOut: MarkdownDeleteOut;
}
