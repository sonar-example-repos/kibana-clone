/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { ClientRequest, OutgoingHttpHeaders, RequestOptions } from 'http';
import http from 'http';
import * as sinon from 'sinon';
import { Readable } from 'stream';
import { proxyRequest } from './proxy_request';
import { URL } from 'url';
import { fail } from 'assert';
import { toURL } from './utils';

describe(`Console's send request`, () => {
  let sandbox: sinon.SinonSandbox;
  let stub: sinon.SinonStub<Parameters<typeof http.request>, ClientRequest>;
  let fakeRequest: ClientRequest | undefined;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    stub = sandbox.stub(http, 'request').callsFake(() => {
      if (!fakeRequest) {
        throw new Error('fakeRequest was not set');
      }
      return fakeRequest;
    });
  });

  afterEach(() => {
    stub.restore();
    fakeRequest = undefined;
  });

  const sendProxyRequest = async ({
    headers = {},
    uri = new URL('http://noone.nowhere.none'),
    timeout = 3000,
  }: {
    headers?: OutgoingHttpHeaders;
    uri?: URL;
    timeout?: number;
  }) => {
    return await proxyRequest({
      agent: new http.Agent(),
      headers,
      method: 'get',
      payload: Readable.from([]),
      uri,
      timeout,
    });
  };

  it('correctly implements timeout and abort mechanism', async () => {
    fakeRequest = {
      destroy: sinon.stub(),
      on() {},
      once() {},
      protocol: 'http:',
      host: 'nowhere.none',
      method: 'POST',
      path: '/_bulk',
    } as unknown as ClientRequest;
    try {
      await sendProxyRequest({ timeout: 0 }); // immediately timeout
      fail('Should not reach here!');
    } catch (e: unknown) {
      if (!(e instanceof Error)) {
        throw e;
      }

      expect(e.message).toEqual(
        'Client request timeout for: http://nowhere.none with request POST /_bulk'
      );
      expect((fakeRequest.destroy as sinon.SinonStub).calledOnce).toBe(true);
    }
  });

  it('correctly sets the "host" header entry', async () => {
    fakeRequest = {
      abort: sinon.stub(),
      on() {},
      once(event: string, fn: (v: string) => void) {
        if (event === 'response') {
          return fn('done');
        }
      },
    } as unknown as ClientRequest;

    // Don't set a host header this time
    const defaultResult = await sendProxyRequest({});

    expect(defaultResult).toEqual('done');

    const httpRequestOptions1 = stub.firstCall.args[0] as RequestOptions;

    expect(httpRequestOptions1.headers).toEqual({
      'content-type': 'application/json',
      host: 'noone.nowhere.none', // Defaults to the provided host name
      'transfer-encoding': 'chunked',
    });

    // Set a host header
    const resultWithHostHeader = await sendProxyRequest({ headers: { Host: 'myhost' } });

    expect(resultWithHostHeader).toEqual('done');

    const httpRequestOptions2 = stub.secondCall.args[0] as RequestOptions;
    expect(httpRequestOptions2.headers).toEqual({
      'content-type': 'application/json',
      Host: 'myhost', // Uses provided host name
      'transfer-encoding': 'chunked',
    });
  });

  describe('with request path', () => {
    beforeEach(() => {
      fakeRequest = {
        abort: sinon.stub(),
        on() {},
        once(event: string, fn: (v: string) => void) {
          if (event === 'response') {
            return fn('done');
          }
        },
      } as unknown as ClientRequest;
    });

    const verifyRequestPath = async ({
      initialPath,
      expectedPath,
    }: {
      initialPath: string;
      expectedPath: string;
      uri?: URL;
    }) => {
      const result = await sendProxyRequest({
        uri: toURL('http://noone.nowhere.none', initialPath),
      });
      expect(result).toEqual('done');
      const httpRequestOptions = stub.firstCall.args[0] as RequestOptions;
      expect(httpRequestOptions.path).toEqual(expectedPath);
    };

    it('should correctly encode invalid URL characters included in path', async () => {
      await verifyRequestPath({
        initialPath: '%{[@metadata][beat]}-%{[@metadata][version]}-2020.08.23',
        expectedPath:
          '/%25%7B%5B%40metadata%5D%5Bbeat%5D%7D-%25%7B%5B%40metadata%5D%5Bversion%5D%7D-2020.08.23?pretty=true',
      });
    });

    it('should not encode the path if it is encoded', async () => {
      await verifyRequestPath({
        initialPath: '%3Cmy-index-%7Bnow%2Fd%7D%3E',
        expectedPath: '/%3Cmy-index-%7Bnow%2Fd%7D%3E?pretty=true',
      });
    });

    it('should correctly encode path with query params', async () => {
      await verifyRequestPath({
        initialPath: '_index/.test?q=something&v=something',
        expectedPath: '/_index/.test?q=something&v=something&pretty=true',
      });
    });
  });
});
