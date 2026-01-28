/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import moment from 'moment';
import http from 'http';
import https from 'https';
import type { Certificate, PeerCertificate } from 'tls';

import { getElasticsearchProxyConfig } from './elasticsearch_proxy_config';
import type { ESConfigForProxy } from '../types';

type ProxyConfigWithSsl = ESConfigForProxy & { ssl: NonNullable<ESConfigForProxy['ssl']> };

const getDefaultElasticsearchConfig = (): ProxyConfigWithSsl => {
  return {
    hosts: ['http://localhost:9200', 'http://192.168.1.1:1234'],
    requestHeadersWhitelist: [],
    customHeaders: {},
    requestTimeout: moment.duration(30000),
    ssl: { verificationMode: 'full', alwaysPresentCertificate: false },
  };
};

describe('platform/plugins/shared/console', () => {
  describe('#getElasticsearchProxyConfig', () => {
    it('sets timeout', () => {
      const value = 1000;
      const proxyConfig = getElasticsearchProxyConfig({
        ...getDefaultElasticsearchConfig(),
        requestTimeout: moment.duration(value),
      });
      expect(proxyConfig.timeout).toBe(value);
    });

    it(`uses https.Agent when url's protocol is https`, () => {
      const { agent } = getElasticsearchProxyConfig({
        ...getDefaultElasticsearchConfig(),
        hosts: ['https://localhost:9200'],
      });
      expect(agent instanceof https.Agent).toBeTruthy();
    });

    it(`uses http.Agent when url's protocol is http`, () => {
      const { agent } = getElasticsearchProxyConfig(getDefaultElasticsearchConfig());
      expect(agent instanceof http.Agent).toBeTruthy();
    });

    describe('ssl', () => {
      let config: ProxyConfigWithSsl;
      beforeEach(() => {
        config = {
          ...getDefaultElasticsearchConfig(),
          hosts: ['https://localhost:9200'],
        };
      });

      it('sets rejectUnauthorized to false when verificationMode is none', () => {
        const { agent } = getElasticsearchProxyConfig({
          ...config,
          ssl: { ...config.ssl, verificationMode: 'none' },
        });
        expect(assertHttpsAgent(agent).options.rejectUnauthorized).toBe(false);
      });

      it('sets rejectUnauthorized to true when verificationMode is certificate', () => {
        const { agent } = getElasticsearchProxyConfig({
          ...config,
          ssl: { ...config.ssl, verificationMode: 'certificate' },
        });
        expect(assertHttpsAgent(agent).options.rejectUnauthorized).toBe(true);
      });

      it('sets checkServerIdentity to not check hostname when verificationMode is certificate', () => {
        const { agent } = getElasticsearchProxyConfig({
          ...config,
          ssl: { ...config.ssl, verificationMode: 'certificate' },
        });

        const cert = createPeerCertificate('wrong.com');

        const httpsAgent = assertHttpsAgent(agent);
        expect(() => httpsAgent.options.checkServerIdentity?.('right.com', cert)).not.toThrow();
        const result = httpsAgent.options.checkServerIdentity?.('right.com', cert);
        expect(result).toBe(undefined);
      });

      it('sets rejectUnauthorized to true when verificationMode is full', () => {
        const { agent } = getElasticsearchProxyConfig({
          ...config,
          ssl: { ...config.ssl, verificationMode: 'full' },
        });

        expect(assertHttpsAgent(agent).options.rejectUnauthorized).toBe(true);
      });

      it(`doesn't set checkServerIdentity when verificationMode is full`, () => {
        const { agent } = getElasticsearchProxyConfig({
          ...config,
          ssl: { ...config.ssl, verificationMode: 'full' },
        });

        expect(assertHttpsAgent(agent).options.checkServerIdentity).toBe(undefined);
      });

      it(`sets ca when certificateAuthorities are specified`, () => {
        const { agent } = getElasticsearchProxyConfig({
          ...config,
          ssl: { ...config.ssl, certificateAuthorities: ['content-of-some-path'] },
        });

        expect(assertHttpsAgent(agent).options.ca).toContain('content-of-some-path');
      });

      describe('when alwaysPresentCertificate is false', () => {
        it(`doesn't set cert and key when certificate and key paths are specified`, () => {
          const { agent } = getElasticsearchProxyConfig({
            ...config,
            ssl: {
              ...config.ssl,
              alwaysPresentCertificate: false,
              certificate: 'content-of-some-path',
              key: 'content-of-another-path',
            },
          });

          const httpsAgent = assertHttpsAgent(agent);
          expect(httpsAgent.options.cert).toBe(undefined);
          expect(httpsAgent.options.key).toBe(undefined);
        });

        it(`doesn't set passphrase when certificate, key and keyPassphrase are specified`, () => {
          const { agent } = getElasticsearchProxyConfig({
            ...config,
            ssl: {
              ...config.ssl,
              alwaysPresentCertificate: false,
              certificate: 'content-of-some-path',
              key: 'content-of-another-path',
              keyPassphrase: 'secret',
            },
          });

          expect(assertHttpsAgent(agent).options.passphrase).toBe(undefined);
        });
      });

      describe('when alwaysPresentCertificate is true', () => {
        it(`sets cert and key when certificate and key are specified`, () => {
          const { agent } = getElasticsearchProxyConfig({
            ...config,
            ssl: {
              ...config.ssl,
              alwaysPresentCertificate: true,
              certificate: 'content-of-some-path',
              key: 'content-of-another-path',
            },
          });

          const httpsAgent = assertHttpsAgent(agent);
          expect(httpsAgent.options.cert).toBe('content-of-some-path');
          expect(httpsAgent.options.key).toBe('content-of-another-path');
        });

        it(`sets passphrase when certificate, key and keyPassphrase are specified`, () => {
          const { agent } = getElasticsearchProxyConfig({
            ...config,
            ssl: {
              ...config.ssl,
              alwaysPresentCertificate: true,
              certificate: 'content-of-some-path',
              key: 'content-of-another-path',
              keyPassphrase: 'secret',
            },
          });

          expect(assertHttpsAgent(agent).options.passphrase).toBe('secret');
        });

        it(`doesn't set cert when only certificate path is specified`, () => {
          const { agent } = getElasticsearchProxyConfig({
            ...config,
            ssl: {
              ...config.ssl,
              alwaysPresentCertificate: true,
              certificate: 'content-of-some-path',
              key: undefined,
            },
          });

          const httpsAgent = assertHttpsAgent(agent);
          expect(httpsAgent.options.cert).toBe(undefined);
          expect(httpsAgent.options.key).toBe(undefined);
        });

        it(`doesn't set key when only key path is specified`, () => {
          const { agent } = getElasticsearchProxyConfig({
            ...config,
            ssl: {
              ...config.ssl,
              alwaysPresentCertificate: true,
              certificate: undefined,
              key: 'content-of-some-path',
            },
          });

          const httpsAgent = assertHttpsAgent(agent);
          expect(httpsAgent.options.cert).toBe(undefined);
          expect(httpsAgent.options.key).toBe(undefined);
        });
      });
    });
  });
});

function createPeerCertificate(commonName: string): PeerCertificate {
  const certificate: Certificate = {
    C: '',
    ST: '',
    L: '',
    O: '',
    OU: '',
    CN: commonName,
  };

  return {
    ca: false,
    raw: Buffer.from(''),
    subject: certificate,
    issuer: certificate,
    valid_from: '',
    valid_to: '',
    serialNumber: '',
    fingerprint: '',
    fingerprint256: '',
    fingerprint512: '',
  };
}

function assertHttpsAgent(agent: http.Agent | https.Agent): https.Agent {
  if (!(agent instanceof https.Agent)) {
    throw new Error('Expected https.Agent');
  }
  return agent;
}
