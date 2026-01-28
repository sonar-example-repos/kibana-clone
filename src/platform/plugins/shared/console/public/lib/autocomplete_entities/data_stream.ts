/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { DataStreamsResponseLike } from './types';

export class DataStream {
  private dataStreams: string[] = [];

  public perDataStreamIndices: Record<string, string[]> = {};

  getDataStreams = (): string[] => {
    return [...this.dataStreams];
  };

  loadDataStreams = (dataStreams: DataStreamsResponseLike) => {
    const list = dataStreams.data_streams ?? [];

    this.dataStreams = list.map(({ name }) => name).sort();

    this.perDataStreamIndices = list.reduce<Record<string, string[]>>((acc, { name, indices }) => {
      const resolvedIndices = indices ?? [];
      acc[name] = resolvedIndices.map((index) => index.index_name);
      return acc;
    }, {});
  };

  clearDataStreams = () => {
    this.dataStreams = [];
  };
}
