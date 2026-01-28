/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { registerStart, registerStop, registerForceLogExtraction } from './apis';
import type { EntityStorePluginRouter } from '../types';

export function registerRoutes(router: EntityStorePluginRouter) {
  registerStart(router);
  registerStop(router);
  registerForceLogExtraction(router);
}
