/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { SavedObjectsClientContract } from '@kbn/core/server';
import type { SetOptional } from 'type-fest';
import type { WatchlistObject } from '../../../../../../common/api/entity_analytics/watchlists/management/common.gen';
import { watchlistConfigTypeName } from './watchlist_config_type';

export const MAX_PER_PAGE = 10_000;

interface WatchlistConfigClientDeps {
  soClient: SavedObjectsClientContract;
  namespace: string;
}

type WatchlistSavedObjectAttributes = Omit<WatchlistObject, 'createdAt' | 'updatedAt'>;

export class WatchlistConfigClient {
  constructor(private readonly deps: WatchlistConfigClientDeps) {}

  getSavedObjectId(name: string) {
    // Use name as unique identifier within namespace
    return `watchlist-config-${this.deps.namespace}-${name}`;
  }

  async create(
    attrs: SetOptional<WatchlistSavedObjectAttributes, 'managed'>
  ): Promise<WatchlistObject> {
    const id = this.getSavedObjectId(attrs.name);
    const { attributes, created_at, updated_at } =
      await this.deps.soClient.create<WatchlistSavedObjectAttributes>(
        watchlistConfigTypeName,
        { ...attrs, managed: attrs.managed ?? false },
        { id, refresh: 'wait_for' }
      );
    return {
      ...attributes,
      createdAt: created_at,
      updatedAt: updated_at,
    };
  }

  async update(
    name: string,
    attrs: Partial<Omit<WatchlistSavedObjectAttributes, 'createdAt' | 'updatedAt'>>
  ) {
    const id = this.getSavedObjectId(name);

    const existing = await this.get(name);
    const update: Partial<WatchlistObject> = {
      ...existing,
      ...attrs,
    };
    const { attributes } = await this.deps.soClient.update<WatchlistObject>(
      watchlistConfigTypeName,
      id,
      update,
      { refresh: 'wait_for' }
    );
    return attributes;
  }

  async find(): Promise<WatchlistObject[]> {
    return this.deps.soClient
      .find<WatchlistObject>({
        type: watchlistConfigTypeName,
        namespaces: [this.deps.namespace],
        perPage: MAX_PER_PAGE,
      })

      .then((response) => {
        return response.saved_objects.map((so) => ({
          ...so.attributes,
          createdAt: so.created_at,
          updatedAt: so.updated_at,
        }));
      });
  }

  async get(name: string) {
    const id = this.getSavedObjectId(name);
    try {
      const so = await this.deps.soClient.get<WatchlistObject>(watchlistConfigTypeName, id);
      return so.attributes;
    } catch (e) {
      if (e.output && e.output.statusCode === 404) {
        throw new Error(`Watchlist config '${name}' not found`);
      }
      throw e;
    }
  }

  async delete(name: string) {
    const id = this.getSavedObjectId(name);
    return this.deps.soClient.delete(watchlistConfigTypeName, id, { refresh: 'wait_for' });
  }
}
