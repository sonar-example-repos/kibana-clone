/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { schema } from '@kbn/config-schema';
import type { ContentManagementServicesDefinition as ServicesDefinition } from '@kbn/object-versioning';
import {
  savedObjectSchema,
  createResultSchema,
  updateOptionsSchema,
  createOptionsSchemas,
  objectTypeToGetResultSchema,
} from '@kbn/content-management-utils';

const baseMarkdownSchema = {
  id: schema.string({ meta: { description: 'The unique ID of the markdown' } }),
  content: schema.string({ meta: { description: 'The markdown content' } }),
};

export const markdownItemAttributesSchema = schema.object(
  {
    ...baseMarkdownSchema,
    title: schema.string({ meta: { description: 'A human-readable title' } }),
    description: schema.maybe(schema.string({ meta: { description: 'A short description.' } })),
  },
  { unknowns: 'forbid' }
);

const markdownSavedObjectSchema = savedObjectSchema(markdownItemAttributesSchema);

export const markdownSearchOptionsSchema = schema.maybe(
  schema.object(
    {
      onlyTitle: schema.maybe(schema.boolean()),
    },
    { unknowns: 'forbid' }
  )
);

export const markdownCreateOptionsSchema = schema.object({
  overwrite: createOptionsSchemas.overwrite,
});

// update references needed because visualize listing table uses content management
// to update title/description/tags and tags passes references in this use case
// TODO remove markdownUpdateOptionsSchema once visualize listing table updated to pass in tags without references
export const markdownUpdateOptionsSchema = schema.object({
  references: updateOptionsSchema.references,
});

export const markdownGetResultSchema = objectTypeToGetResultSchema(markdownSavedObjectSchema);
export const markdownCreateResultSchema = createResultSchema(markdownSavedObjectSchema);

// Content management service definition.
// We need it for BWC support between different versions of the content
export const serviceDefinition: ServicesDefinition = {
  get: {
    out: {
      result: {
        schema: markdownGetResultSchema,
      },
    },
  },
  create: {
    in: {
      options: {
        schema: markdownCreateOptionsSchema,
      },
      data: {
        schema: markdownItemAttributesSchema,
      },
    },
    out: {
      result: {
        schema: markdownCreateResultSchema,
      },
    },
  },
  update: {
    in: {
      options: {
        schema: markdownUpdateOptionsSchema,
      },
      data: {
        schema: markdownItemAttributesSchema,
      },
    },
  },
  search: {
    in: {
      options: {
        schema: markdownSearchOptionsSchema,
      },
    },
  },
  mSearch: {
    out: {
      result: {
        schema: markdownSavedObjectSchema,
      },
    },
  },
};
