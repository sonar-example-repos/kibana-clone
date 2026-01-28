/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { coreMock, httpServerMock } from '@kbn/core/server/mocks';
import { getProxyRouteHandlerDeps } from './mocks';
import { createResponseStub } from './stubs';
import * as requestModule from '../../../../lib/proxy_request';

import { createHandler } from './create_handler';

describe('Console Proxy Route', () => {
  let request: (method: string, path: string) => Promise<void>;
  const proxyRequestMock = jest.mocked(requestModule.proxyRequest);

  beforeEach(() => {
    jest.mocked(requestModule.proxyRequest).mockResolvedValue(createResponseStub('foo'));

    request = async (method: string, path: string) => {
      const handler = createHandler(getProxyRouteHandlerDeps({}));

      const ctx = coreMock.createCustomRequestHandlerContext({});
      const req = httpServerMock.createKibanaRequest({
        headers: {},
        query: { method, path },
      });
      const res = httpServerMock.createResponseFactory();

      await handler(ctx, req, res);
      expect(res.ok).toHaveBeenCalledTimes(1);
    };
  });

  afterEach(async () => {
    jest.resetAllMocks();
  });

  describe('query string', () => {
    describe('path', () => {
      describe('contains full url', () => {
        it('treats the url as a path', async () => {
          await request('GET', 'http://evil.com/test');
          expect(proxyRequestMock.mock.calls.length).toBe(1);
          const [[args]] = jest.mocked(requestModule.proxyRequest).mock.calls;
          expect(args.uri.href).toBe('http://localhost:9200/http%3A//evil.com/test?pretty=true');
        });
      });
      describe('starts with a slash', () => {
        it('combines well with the base url', async () => {
          await request('GET', '/index/id');
          expect(proxyRequestMock.mock.calls.length).toBe(1);
          const [[args]] = jest.mocked(requestModule.proxyRequest).mock.calls;
          expect(args.uri.href).toBe('http://localhost:9200/index/id?pretty=true');
        });
      });
      describe(`doesn't start with a slash`, () => {
        it('combines well with the base url', async () => {
          await request('GET', 'index/id');
          expect(proxyRequestMock.mock.calls.length).toBe(1);
          const [[args]] = jest.mocked(requestModule.proxyRequest).mock.calls;
          expect(args.uri.href).toBe('http://localhost:9200/index/id?pretty=true');
        });
      });
      describe('contains special characters', () => {
        it('correctly encodes plus sign', async () => {
          const path = '/_search?q=create_date:[2022-03-10T08:00:00.000+08:00 TO *]';

          await request('GET', path);
          expect(proxyRequestMock.mock.calls.length).toBe(1);
          const [[args]] = proxyRequestMock.mock.calls;
          expect(args.uri.search).toEqual(
            '?q=create_date%3A%5B2022-03-10T08%3A00%3A00.000%2B08%3A00+TO+*%5D&pretty=true'
          );
        });
      });
    });
  });
});
