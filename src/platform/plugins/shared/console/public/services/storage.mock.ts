/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { Storage } from './storage';

function createInMemoryStorageEngine(): typeof window.localStorage {
  const store: Record<string, string> = Object.create(null);

  const engine: Record<string, unknown> & {
    length: number;
    key: (index: number) => string | null;
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
    clear: () => void;
  } = Object.create(null);

  const syncLength = () => {
    engine.length = Object.keys(store).length;
  };

  engine.key = (index: number) => Object.keys(store)[index] ?? null;

  engine.getItem = (key: string) => {
    return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
  };

  engine.setItem = (key: string, value: string) => {
    store[key] = value;
    engine[key] = value;
    syncLength();
  };

  engine.removeItem = (key: string) => {
    delete store[key];
    delete engine[key];
    syncLength();
  };

  engine.clear = () => {
    for (const key of Object.keys(store)) {
      delete store[key];
      delete engine[key];
    }
    syncLength();
  };

  syncLength();

  return engine as unknown as typeof window.localStorage;
}

export class StorageMock extends Storage {
  constructor(initialState: Record<string, unknown> = {}, prefix: string = 'test') {
    super(createInMemoryStorageEngine(), prefix);

    for (const [key, value] of Object.entries(initialState)) {
      this.set(key, value);
    }
  }
}
