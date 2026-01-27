/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { Logger } from '@kbn/logging';
import type { HttpSetup, IUiSettingsClient } from '@kbn/core/public';
import { useEffect } from 'react';
import { ENTITY_STORE_ROUTES, FF_ENABLE_ENTITY_STORE_V2 } from '../common';

interface Services {
  http: HttpSetup;
  uiSettings: IUiSettingsClient;
  logger: Logger;
}

/**
 * to be used in SecurityAppComponent (root security soluition app component)
 */
export const useRegisterEntityStoreV2 = (services: Services) => {
  useEffect(() => {
    const logger = services.logger.get('InitEntityStoreV2');

    const isEnabled = services.uiSettings.get(FF_ENABLE_ENTITY_STORE_V2);
    logger.info(`Initialize Entity Store V2: ${isEnabled}`);
    if (!isEnabled) return;

    logger.info('Initializing');
    services.http
      .post(ENTITY_STORE_ROUTES.START, { body: JSON.stringify({}), query: { apiVersion: '2' } })
      .then(() => {
        logger.info('Initialized');
      })
      .catch((e) => {
        logger.error('Failed to initialize');
        logger.error(e);
      });
  }, [services.http, services.uiSettings, services.logger]);
};
