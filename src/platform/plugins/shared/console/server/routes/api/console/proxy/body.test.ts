/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { getProxyRouteHandlerDeps } from './mocks';

import { Readable } from 'stream';

import { coreMock, httpServerMock } from '@kbn/core/server/mocks';
import { createHandler } from './create_handler';
import * as requestModule from '../../../../lib/proxy_request';
import { createResponseStub } from './stubs';

describe('Console Proxy Route', () => {
  let request: (method: string, path: string, response?: string) => Promise<string | Readable>;

  beforeEach(() => {
    request = (method, path, response) => {
      jest.mocked(requestModule.proxyRequest).mockResolvedValue(createResponseStub(response));
      const handler = createHandler(getProxyRouteHandlerDeps({}));

      const ctx = coreMock.createCustomRequestHandlerContext({});
      const req = httpServerMock.createKibanaRequest({
        headers: {},
        query: { method, path },
      });
      const res = httpServerMock.createResponseFactory();

      return (async () => {
        await handler(ctx, req, res);
        expect(res.ok).toHaveBeenCalledTimes(1);
        const okArgs = res.ok.mock.calls[0]?.[0];
        if (!okArgs) {
          throw new Error('Expected response.ok() to be called with args');
        }
        return okArgs.body as string | Readable;
      })();
    };
  });

  const readStream = (s: Readable) =>
    new Promise((resolve) => {
      let v = '';
      s.on('data', (data) => {
        v += data;
      });
      s.on('end', () => resolve(v));
    });

  afterEach(async () => {
    jest.resetAllMocks();
  });

  describe('response body', () => {
    describe('GET request', () => {
      it('returns the exact body', async () => {
        const body = await request('GET', '/', 'foobar');
        if (!(body instanceof Readable)) {
          throw new Error('Expected response body to be a Readable stream');
        }
        expect(await readStream(body)).toBe('foobar');
      });
    });
    describe('POST request', () => {
      it('returns the exact body', async () => {
        const body = await request('POST', '/', 'foobar');
        if (!(body instanceof Readable)) {
          throw new Error('Expected response body to be a Readable stream');
        }
        expect(await readStream(body)).toBe('foobar');
      });
    });
    describe('PUT request', () => {
      it('returns the exact body', async () => {
        const body = await request('PUT', '/', 'foobar');
        if (!(body instanceof Readable)) {
          throw new Error('Expected response body to be a Readable stream');
        }
        expect(await readStream(body)).toBe('foobar');
      });
    });
    describe('DELETE request', () => {
      it('returns the exact body', async () => {
        const body = await request('DELETE', '/', 'foobar');
        if (!(body instanceof Readable)) {
          throw new Error('Expected response body to be a Readable stream');
        }
        expect(await readStream(body)).toBe('foobar');
      });
    });
    describe('HEAD request', () => {
      it('returns the status code and text', async () => {
        const body = await request('HEAD', '/');
        expect(typeof body).toBe('string');
        expect(body).toBe('200 - OK');
      });
      describe('mixed casing', () => {
        it('returns the status code and text', async () => {
          const body = await request('HeAd', '/');
          expect(typeof body).toBe('string');
          expect(body).toBe('200 - OK');
        });
      });
    });
    describe('PATCH request', () => {
      it('returns the exact body', async () => {
        const body = await request('PATCH', '/', 'foobar');
        if (!(body instanceof Readable)) {
          throw new Error('Expected response body to be a Readable stream');
        }
        expect(await readStream(body)).toBe('foobar');
      });
    });
  });
});
