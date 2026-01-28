/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { Logger } from '@kbn/logging';
import type { ElasticsearchClient, KibanaRequest } from '@kbn/core/server';
import type { TaskManagerStartContract } from '@kbn/task-manager-plugin/server';
import { getEntityDefinition } from './definitions/registry';
import type { EntityType } from './definitions/entity_schema';
import { scheduleExtractEntityTask, stopExtractEntityTask } from '../tasks/extract_entity_task';
import { installElasticsearchAssets, uninstallElasticsearchAssets } from './assets/install_assets';

export class AssetManager {
  constructor(
    private logger: Logger,
    private esClient: ElasticsearchClient,
    private taskManager: TaskManagerStartContract,
    private namespace: string
  ) {}

  public async start(request: KibanaRequest, type: EntityType, logExtractionFrequency?: string) {
    // TODO: return early if already started

    // TODO: optionally return SO descriptor
    await installElasticsearchAssets({
      esClient: this.esClient,
      logger: this.logger.get(type),
      definition: getEntityDefinition(type, this.namespace),
      namespace: this.namespace,
    });

    // TODO: if this fails, set status to failed
    await scheduleExtractEntityTask({
      logger: this.logger,
      taskManager: this.taskManager,
      type,
      frequency: logExtractionFrequency,
      namespace: this.namespace,
      request,
    });
  }

  public async stop(type: EntityType) {
    // TODO: return early if not installed+started
    await stopExtractEntityTask({
      taskManager: this.taskManager,
      logger: this.logger,
      type,
      namespace: this.namespace,
    });

    // TODO: add flag to delete data or not
    await uninstallElasticsearchAssets({
      esClient: this.esClient,
      logger: this.logger.get(type),
      definition: getEntityDefinition(type, this.namespace),
      namespace: this.namespace,
    });
  }
}
