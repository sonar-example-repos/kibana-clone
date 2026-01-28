/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type {
  ClusterGetComponentTemplateResponse,
  IndicesGetAliasResponse,
  IndicesGetDataStreamResponse,
  IndicesGetIndexTemplateResponse,
  IndicesGetMappingResponse,
  IndicesGetTemplateResponse,
} from '@elastic/elasticsearch/lib/api/types';

export interface Field {
  name: string;
  type?: string;
}

export interface FieldMapping {
  enabled?: boolean;
  path?: string;
  properties?: Record<string, FieldMapping>;
  type?: string;
  index_name?: string;
  fields?: Record<string, FieldMapping>;
}

/**
 * These types are derived from the official ES client response types but narrowed to only the
 * fields Console actually consumes.
 */
export interface IndexTemplatesResponseLike {
  index_templates?: Array<
    Pick<NonNullable<IndicesGetIndexTemplateResponse['index_templates']>[number], 'name'>
  >;
}

export interface ComponentTemplatesResponseLike {
  component_templates?: Array<
    Pick<NonNullable<ClusterGetComponentTemplateResponse['component_templates']>[number], 'name'>
  >;
}

export interface DataStreamsResponseLike {
  data_streams?: Array<
    Pick<NonNullable<IndicesGetDataStreamResponse['data_streams']>[number], 'name'> & {
      indices?: Array<
        Pick<
          NonNullable<
            NonNullable<IndicesGetDataStreamResponse['data_streams']>[number]['indices']
          >[number],
          'index_name'
        >
      >;
    }
  >;
}

export type LegacyTemplatesResponseLike = Record<
  string,
  Partial<IndicesGetTemplateResponse[string]>
>;

export interface AutoCompleteEntitiesApiResponse {
  mappings: IndicesGetMappingResponse;
  aliases: IndicesGetAliasResponse;
  dataStreams: IndicesGetDataStreamResponse;
  legacyTemplates: IndicesGetTemplateResponse;
  indexTemplates: IndicesGetIndexTemplateResponse;
  componentTemplates: ClusterGetComponentTemplateResponse;
}
