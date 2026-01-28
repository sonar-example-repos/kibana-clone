/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { ContextValue } from '../../contexts';
import type { RequestResult } from './send_request';

jest.mock('./send_request', () => ({ sendRequest: jest.fn(() => Promise.resolve()) }));

import { sendRequest } from './send_request';
import { serviceContextMock } from '../../contexts/services_context.mock';

const mockedSendRequest = jest.mocked(sendRequest);

describe('sendRequest', () => {
  let mockContextValue: ContextValue;

  beforeEach(() => {
    mockContextValue = serviceContextMock.create();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should send request', async () => {
    const result: RequestResult[] = [
      {
        request: { data: '', method: 'PUT', path: 'test' },
        response: {
          timeMs: 0,
          statusCode: 200,
          statusText: 'OK',
          contentType: 'application/json',
          value: '{\n  "acknowledged": true \n}',
        },
      },
    ];
    mockedSendRequest.mockResolvedValue(result);

    const args = {
      http: mockContextValue.services.http,
      requests: [{ method: 'PUT', url: 'test', data: [] }],
    };
    const results = await sendRequest(args);

    const [request] = results;
    expect(request.response.statusCode).toEqual(200);
    expect(request.response.value).toContain('"acknowledged": true');
    expect(mockedSendRequest).toHaveBeenCalledWith(args);
    expect(mockedSendRequest).toHaveBeenCalledTimes(1);
  });

  describe('with multiple requests', () => {
    it('should return results with exceptions', async () => {
      const result: RequestResult[] = [
        {
          request: { data: '', method: 'GET', path: 'success' },
          response: {
            timeMs: 0,
            statusCode: 200,
            statusText: 'OK',
            contentType: 'application/json',
            value: '',
          },
        },
        {
          request: { data: '', method: 'GET', path: 'success' },
          response: {
            timeMs: 0,
            statusCode: 200,
            statusText: 'OK',
            contentType: 'application/json',
            value: '',
          },
        },
        {
          request: { data: '', method: 'GET', path: 'fail' },
          response: {
            timeMs: 0,
            statusCode: 400,
            statusText: 'Bad Request',
            contentType: 'application/json',
            value: '',
          },
        },
      ];
      mockedSendRequest.mockResolvedValue(result);

      const args = {
        http: mockContextValue.services.http,
        requests: [
          { method: 'GET', url: 'success', data: [] },
          { method: 'GET', url: 'success', data: [] },
          { method: 'GET', url: 'fail', data: [] },
        ],
      };
      const results = await sendRequest(args);

      const [firstCall, secondCall, thirdCall] = results;
      expect(firstCall.response.statusCode).toEqual(200);
      expect(secondCall.response.statusCode).toEqual(200);
      expect(thirdCall.response.statusCode).toEqual(400);
      expect(mockedSendRequest).toHaveBeenCalledWith(args);
      expect(mockedSendRequest).toHaveBeenCalledTimes(1);
    });
  });

  it('should handle errors', async () => {
    mockedSendRequest.mockRejectedValue({
      response: {
        timeMs: 0,
        statusCode: 500,
        statusText: 'error',
        contentType: 'application/json',
        value: '',
      },
    });

    try {
      await sendRequest({
        http: mockContextValue.services.http,
        requests: [{ method: 'GET', url: 'test', data: [] }],
      });
    } catch (error: unknown) {
      if (
        typeof error !== 'object' ||
        error === null ||
        !('response' in error) ||
        typeof (error as { response?: unknown }).response !== 'object' ||
        (error as { response?: unknown }).response === null
      ) {
        throw error;
      }

      const { response } = error as { response: { statusCode: number; statusText: string } };
      expect(response.statusCode).toEqual(500);
      expect(response.statusText).toEqual('error');
      expect(mockedSendRequest).toHaveBeenCalledTimes(1);
    }
  });

  describe('successful response value', () => {
    describe('with text', () => {
      it('should return value with lines separated', async () => {
        const value = '\ntest_index-1    []\ntest_index-2    []\n';
        const result: RequestResult[] = [
          {
            request: { data: '', method: 'GET', path: 'test-1' },
            response: {
              timeMs: 0,
              statusCode: 200,
              statusText: 'OK',
              contentType: 'text/plain',
              value,
            },
          },
        ];
        mockedSendRequest.mockResolvedValue(result);
        const response = await sendRequest({
          http: mockContextValue.services.http,
          requests: [{ method: 'GET', url: 'test-1', data: [] }],
        });

        expect(response[0].response.value).toMatchInlineSnapshot(`
          "
          test_index-1    []
          test_index-2    []
          "
        `);
        expect(mockedSendRequest).toHaveBeenCalledTimes(1);
      });
    });

    describe('with parsed json', () => {
      it('should stringify value', async () => {
        const result: RequestResult[] = [
          {
            request: { data: '', method: 'GET', path: 'test-2' },
            response: {
              timeMs: 0,
              statusCode: 200,
              statusText: 'OK',
              contentType: 'application/json',
              value: JSON.stringify({ test: 'some value' }),
            },
          },
        ];
        mockedSendRequest.mockResolvedValue(result);
        const response = await sendRequest({
          http: mockContextValue.services.http,
          requests: [{ method: 'GET', url: 'test-2', data: [] }],
        });

        expect(typeof response[0].response.value).toBe('string');
        expect(mockedSendRequest).toHaveBeenCalledTimes(1);
      });
    });
  });
});
