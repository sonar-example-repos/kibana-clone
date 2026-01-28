/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { buildRouteValidationWithZod } from '@kbn/zod-helpers';
import { z } from '@kbn/zod';
import type { IKibanaResponse } from '@kbn/core-http-server';
import { API_VERSIONS, DEFAULT_ENTITY_STORE_PERMISSIONS } from '../constants';
import type { EntityStorePluginRouter } from '../../types';
import { wrapMiddlewares } from '../middleware';
import { EntityType, ALL_ENTITY_TYPES } from '../../domain/definitions/entity_schema';
import { ENTITY_STORE_ROUTES } from '../../../common';

const bodySchema = z.object({
  entityTypes: z.array(EntityType).optional().default(ALL_ENTITY_TYPES),
  logExtractionFrequency: z
    .string()
    .regex(/^\d+[smdh]$/)
    .optional(),
});

export function registerStart(router: EntityStorePluginRouter) {
  router.versioned
    .post({
      path: ENTITY_STORE_ROUTES.START,
      access: 'internal',
      security: {
        authz: DEFAULT_ENTITY_STORE_PERMISSIONS,
      },
      enableQueryVersion: true,
    })
    .addVersion(
      {
        version: API_VERSIONS.internal.v2,
        validate: {
          request: {
            body: buildRouteValidationWithZod(bodySchema),
          },
        },
      },
      wrapMiddlewares(async (ctx, req, res): Promise<IKibanaResponse> => {
        const { logger, assetManager } = await ctx.entityStore;
        const { entityTypes, logExtractionFrequency } = req.body;
        logger.debug(`Starting entity store for: [${req.body.entityTypes.join(', ')}]`);

        await Promise.all(
          entityTypes.map((type) => assetManager.start(req, type, logExtractionFrequency))
        );

        return res.ok({
          body: {
            ok: true,
          },
        });
      })
    );
}
