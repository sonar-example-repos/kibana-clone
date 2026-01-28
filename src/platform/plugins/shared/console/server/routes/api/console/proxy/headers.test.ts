/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

jest.mock('@kbn/core-http-router-server-internal', () => {
  const realModule = jest.requireActual('@kbn/core-http-router-server-internal');
  return {
    ...realModule,
    ensureRawRequest: jest.fn(),
  };
});

import { coreMock, httpServerMock } from '@kbn/core/server/mocks';

import { ensureRawRequest } from '@kbn/core-http-router-server-internal';
import { hapiMocks } from '@kbn/hapi-mocks';

import { getProxyRouteHandlerDeps } from './mocks';

import * as requestModule from '../../../../lib/proxy_request';

import { createHandler } from './create_handler';

import { createResponseStub } from './stubs';

describe('Console Proxy Route', () => {
  let handler: ReturnType<typeof createHandler>;

  beforeEach(() => {
    jest.mocked(requestModule.proxyRequest).mockResolvedValue(createResponseStub(''));
    handler = createHandler(getProxyRouteHandlerDeps({}));
  });

  afterEach(async () => {
    jest.resetAllMocks();
  });

  describe('headers', () => {
    it('forwards the remote header info', async () => {
      jest.mocked(ensureRawRequest).mockReturnValue(
        hapiMocks.createRequest({
          info: {
            remoteAddress: '0.0.0.0',
            remotePort: '1234',
            host: 'test',
          },
          server: {
            info: {
              protocol: 'http',
            },
          },
        })
      );

      const ctx = coreMock.createCustomRequestHandlerContext({});
      const req = httpServerMock.createKibanaRequest({
        headers: {},
        query: {
          method: 'POST',
          path: '/api/console/proxy?method=GET&path=/',
        },
      });
      const res = httpServerMock.createResponseFactory();

      await handler(ctx, req, res);

      expect(jest.mocked(requestModule.proxyRequest).mock.calls.length).toBe(1);
      const [[{ headers }]] = jest.mocked(requestModule.proxyRequest).mock.calls;
      expect(headers).toHaveProperty('x-forwarded-for');
      expect(headers['x-forwarded-for']).toBe('0.0.0.0');
      expect(headers).toHaveProperty('x-forwarded-port');
      expect(headers['x-forwarded-port']).toBe('1234');
      expect(headers).toHaveProperty('x-forwarded-proto');
      expect(headers['x-forwarded-proto']).toBe('http');
      expect(headers).toHaveProperty('x-forwarded-host');
      expect(headers['x-forwarded-host']).toBe('test');
    });

    it('sends product-origin header when withProductOrigin query param is set', async () => {
      const ctx = coreMock.createCustomRequestHandlerContext({});
      const req = httpServerMock.createKibanaRequest({
        headers: {},
        query: {
          method: 'POST',
          path: '/api/console/proxy?path=_aliases&method=GET',
          withProductOrigin: true,
        },
      });
      const res = httpServerMock.createResponseFactory();

      await handler(ctx, req, res);

      const [[{ headers }]] = jest.mocked(requestModule.proxyRequest).mock.calls;
      expect(headers).toHaveProperty('x-elastic-product-origin');
      expect(headers['x-elastic-product-origin']).toBe('kibana');
    });

    it('sends es status code and status text as headers', async () => {
      const ctx = coreMock.createCustomRequestHandlerContext({});
      const req = httpServerMock.createKibanaRequest({
        headers: {},
        query: {
          method: 'POST',
          path: '/api/console/proxy?path=_aliases&method=GET',
        },
      });
      const res = httpServerMock.createResponseFactory();

      await handler(ctx, req, res);

      expect(res.ok).toHaveBeenCalledTimes(1);
      const okArgs = res.ok.mock.calls[0]?.[0];
      if (!okArgs) {
        throw new Error('Expected response.ok() to be called with args');
      }
      expect(okArgs.headers).toHaveProperty('x-console-proxy-status-code');
      expect(okArgs.headers).toHaveProperty('x-console-proxy-status-text');
    });
  });
});
