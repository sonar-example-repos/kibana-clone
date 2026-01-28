/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import _ from 'lodash';

import type { AutoCompleteContext, AutocompleteTerm, ResultTerm } from './types';
import type { TokenPathToken } from './engine';

import { URL_PATH_END_MARKER, UrlPatternMatcher, ListComponent } from './components';
import { populateContext } from './engine';
import { UrlParams } from './url_params';
import type { SharedComponent } from './components/shared_component';
import type { ParametrizedComponentFactories as UrlParametrizedComponentFactories } from './components/url_pattern_matcher';

interface TestEndpoint {
  patterns: string[];
  methods: string[];
  url_components?: Record<string, unknown>;
  priority?: number;
}

interface ExpectedContext {
  autoCompleteSet?: AutocompleteTerm[];
  endpoint?: string;
  method?: string;
  [key: string]: unknown;
}

type GlobalFactory = (name: string, parent: SharedComponent) => SharedComponent | undefined;

describe('Url autocomplete', () => {
  function patternsTest(
    name: string,
    endpoints: Record<string, TestEndpoint>,
    tokenPath: TokenPathToken[] | string,
    expectedContext: ExpectedContext,
    globalUrlComponentFactories?: UrlParametrizedComponentFactories
  ) {
    test(name, () => {
      const patternMatcher = new UrlPatternMatcher(globalUrlComponentFactories);

      for (const [id, e] of Object.entries(endpoints)) {
        const fullEndpoint: NonNullable<AutoCompleteContext['endpoint']> & {
          id: string;
          patterns: string[];
          methods: string[];
          url_components?: Record<string, unknown>;
          priority?: number;
        } = {
          id,
          patterns: e.patterns,
          methods: e.methods,
          url_components: e.url_components,
          priority: e.priority,
          paramsAutocomplete: new UrlParams(undefined),
          bodyAutocompleteRootComponents: [],
        };

        for (const p of e.patterns) {
          patternMatcher.addEndpoint(p, fullEndpoint);
        }
      }

      const parsedTokenPath: TokenPathToken[] =
        typeof tokenPath === 'string'
          ? tokenPath
              .replace(/\$$/, `/${URL_PATH_END_MARKER}`)
              .split('/')
              .map((p) => {
                const parts = p.split(',');
                return parts.length === 1 ? parts[0] : parts;
              })
          : tokenPath;

      const context: AutoCompleteContext = {};
      if (expectedContext.method) {
        context.method = expectedContext.method;
      }

      populateContext(
        parsedTokenPath,
        context,
        undefined,
        Boolean(expectedContext.autoCompleteSet),
        patternMatcher.getTopLevelComponents(context.method)
      );

      expect(normalizeActualContext(context)).toEqual(normalizeExpectedContext(expectedContext));
    });
  }

  function t(name: string, meta?: string): AutocompleteTerm {
    if (!meta) return name;
    const term: ResultTerm = { name, meta };
    return term;
  }

  (() => {
    const endpoints: Record<string, TestEndpoint> = {
      1: {
        patterns: ['a/b'],
        methods: ['GET'],
      },
    };

    patternsTest('simple single path - completion', endpoints, 'a/b$', {
      endpoint: '1',
      method: 'GET',
    });

    patternsTest('simple single path - completion, with auto complete', endpoints, 'a/b', {
      method: 'GET',
      autoCompleteSet: [],
    });

    patternsTest('simple single path - partial, without auto complete', endpoints, 'a', {});

    patternsTest('simple single path - partial, with auto complete', endpoints, 'a', {
      method: 'GET',
      autoCompleteSet: ['b'],
    });

    patternsTest('simple single path - partial, with auto complete', endpoints, [], {
      method: 'GET',
      autoCompleteSet: ['a/b'],
    });

    patternsTest('simple single path - different path', endpoints, 'a/c', {});
  })();

  (() => {
    const endpoints: Record<string, TestEndpoint> = {
      1: {
        patterns: ['a/b', 'a/b/{p}'],
        methods: ['GET'],
      },
      2: {
        patterns: ['a/c'],
        methods: ['GET'],
      },
    };

    patternsTest('shared path  - completion 1', endpoints, 'a/b$', {
      endpoint: '1',
      method: 'GET',
    });

    patternsTest('shared path  - completion 2', endpoints, 'a/c$', {
      endpoint: '2',
      method: 'GET',
    });

    patternsTest('shared path  - completion 1 with param', endpoints, 'a/b/v$', {
      method: 'GET',
      endpoint: '1',
      p: 'v',
    });

    patternsTest('shared path - partial, with auto complete', endpoints, 'a', {
      autoCompleteSet: ['b', 'c'],
      method: 'GET',
    });

    patternsTest(
      'shared path - partial, with auto complete of param, no options',
      endpoints,
      'a/b',
      { method: 'GET', autoCompleteSet: [] }
    );

    patternsTest('shared path - partial, without auto complete', endpoints, 'a', { method: 'GET' });

    patternsTest('shared path - different path - with auto complete', endpoints, 'a/e', {
      method: 'GET',
      autoCompleteSet: [],
    });

    patternsTest('shared path - different path - without auto complete', endpoints, 'a/e', {
      method: 'GET',
    });
  })();

  (() => {
    const endpoints: Record<string, TestEndpoint> = {
      1: {
        patterns: ['a/{p}'],
        url_components: {
          p: ['a', 'b'],
        },
        methods: ['GET'],
      },
      2: {
        patterns: ['a/c'],
        methods: ['GET'],
      },
    };

    patternsTest('option testing - completion 1', endpoints, 'a/a$', {
      method: 'GET',
      endpoint: '1',
      p: ['a'],
    });

    patternsTest('option testing - completion 2', endpoints, 'a/b$', {
      method: 'GET',
      endpoint: '1',
      p: ['b'],
    });

    patternsTest('option testing - completion 3', endpoints, 'a/b,a$', {
      method: 'GET',
      endpoint: '1',
      p: ['b', 'a'],
    });

    patternsTest('option testing - completion 4', endpoints, 'a/c$', {
      method: 'GET',
      endpoint: '2',
    });

    patternsTest('option testing  - completion 5', endpoints, 'a/d$', { method: 'GET' });

    patternsTest('option testing - partial, with auto complete', endpoints, 'a', {
      method: 'GET',
      autoCompleteSet: [t('a', 'p'), t('b', 'p'), 'c'],
    });

    patternsTest('option testing - partial, without auto complete', endpoints, 'a', {
      method: 'GET',
    });

    patternsTest('option testing - different path - with auto complete', endpoints, 'a/e', {
      method: 'GET',
      autoCompleteSet: [],
    });
  })();

  (() => {
    const endpoints: Record<string, TestEndpoint> = {
      1: {
        patterns: ['a/{p}'],
        url_components: {
          p: ['a', 'b'],
        },
        methods: ['GET'],
      },
      2: {
        patterns: ['b/{p}'],
        methods: ['GET'],
      },
      3: {
        patterns: ['b/{l}/c'],
        methods: ['GET'],
        url_components: {
          l: {
            type: 'list',
            list: ['la', 'lb'],
            allow_non_valid: true,
          },
        },
      },
    };

    const factories: Record<string, GlobalFactory | undefined> = {
      p: (name, parent) => new ListComponent(name, ['g1', 'g2'], parent),
    };

    const globalFactories: UrlParametrizedComponentFactories = {
      getComponent: (name) => factories[name],
    };

    patternsTest(
      'global parameters testing - completion 1',
      endpoints,
      'a/a$',
      { method: 'GET', endpoint: '1', p: ['a'] },
      globalFactories
    );

    patternsTest(
      'global parameters testing - completion 2',
      endpoints,
      'b/g1$',
      { method: 'GET', endpoint: '2', p: ['g1'] },
      globalFactories
    );

    patternsTest(
      'global parameters testing - partial, with auto complete',
      endpoints,
      'a',
      { method: 'GET', autoCompleteSet: [t('a', 'p'), t('b', 'p')] },
      globalFactories
    );

    patternsTest(
      'global parameters testing - partial, with auto complete 2',
      endpoints,
      'b',
      {
        method: 'GET',
        autoCompleteSet: [t('g1', 'p'), t('g2', 'p'), t('la', 'l'), t('lb', 'l')],
      },
      globalFactories
    );

    patternsTest(
      'Non valid token acceptance - partial, with auto complete 1',
      endpoints,
      'b/la',
      { method: 'GET', autoCompleteSet: ['c'], l: ['la'] },
      globalFactories
    );

    patternsTest(
      'Non valid token acceptance - partial, with auto complete 2',
      endpoints,
      'b/non_valid',
      { method: 'GET', autoCompleteSet: ['c'], l: ['non_valid'] },
      globalFactories
    );
  })();

  (() => {
    const endpoints: Record<string, TestEndpoint> = {
      1: {
        patterns: ['a/b/{p}/c/e'],
        methods: ['GET'],
      },
    };

    patternsTest('look ahead - autocomplete before param 1', endpoints, 'a', {
      method: 'GET',
      autoCompleteSet: ['b'],
    });

    patternsTest('look ahead - autocomplete before param 2', endpoints, [], {
      method: 'GET',
      autoCompleteSet: ['a/b'],
    });

    patternsTest('look ahead - autocomplete after param 1', endpoints, 'a/b/v', {
      method: 'GET',
      autoCompleteSet: ['c/e'],
      p: 'v',
    });

    patternsTest('look ahead - autocomplete after param 2', endpoints, 'a/b/v/c', {
      method: 'GET',
      autoCompleteSet: ['e'],
      p: 'v',
    });
  })();

  (() => {
    const endpoints: Record<string, TestEndpoint> = {
      '1_param': {
        patterns: ['a/{p}'],
        methods: ['GET'],
      },
      '2_explicit': {
        patterns: ['a/b'],
        methods: ['GET'],
      },
    };

    const e1 = _.cloneDeep(endpoints);
    e1['1_param'].priority = 1;
    patternsTest('Competing endpoints - priority 1', e1, 'a/b$', {
      method: 'GET',
      endpoint: '1_param',
      p: 'b',
    });

    const e2 = _.cloneDeep(endpoints);
    e2['1_param'].priority = 1;
    e2['2_explicit'].priority = 0;
    patternsTest('Competing endpoints - priority 2', e2, 'a/b$', {
      method: 'GET',
      endpoint: '2_explicit',
    });

    const e3 = _.cloneDeep(endpoints);
    e3['2_explicit'].priority = 0;
    patternsTest('Competing endpoints - priority 3', e3, 'a/b$', {
      method: 'GET',
      endpoint: '2_explicit',
    });
  })();

  (() => {
    const endpoints: Record<string, TestEndpoint> = {
      '1_GET': {
        patterns: ['a'],
        methods: ['GET'],
      },
      '1_PUT': {
        patterns: ['a'],
        methods: ['PUT'],
      },
      '2_GET': {
        patterns: ['a/b'],
        methods: ['GET'],
      },
      '2_DELETE': {
        patterns: ['a/b'],
        methods: ['DELETE'],
      },
    };

    patternsTest('Competing endpoint - sub url of another - auto complete', endpoints, 'a', {
      method: 'GET',
      autoCompleteSet: ['b'],
    });

    patternsTest('Competing endpoint - sub url of another, complete 1', endpoints, 'a$', {
      method: 'GET',
      endpoint: '1_GET',
    });

    patternsTest('Competing endpoint - sub url of another, complete 2', endpoints, 'a$', {
      method: 'PUT',
      endpoint: '1_PUT',
    });

    patternsTest('Competing endpoint - sub url of another, complete 3', endpoints, 'a$', {
      method: 'DELETE',
    });

    patternsTest(
      'Competing endpoint - extension of another, complete 1, auto complete',
      endpoints,
      'a/b$',
      { method: 'PUT', autoCompleteSet: [] }
    );

    patternsTest('Competing endpoint - extension of another, complete 1', endpoints, 'a/b$', {
      method: 'GET',
      endpoint: '2_GET',
    });

    patternsTest('Competing endpoint - extension of another, complete 1', endpoints, 'a/b$', {
      method: 'DELETE',
      endpoint: '2_DELETE',
    });

    patternsTest('Competing endpoint - extension of another, complete 1', endpoints, 'a/b$', {
      method: 'PUT',
    });
  })();
});

function normalizeExpectedContext(expected: ExpectedContext): Record<string, unknown> {
  const out: Record<string, unknown> = { ...expected };
  if (expected.autoCompleteSet) {
    out.autoCompleteSet = _.sortBy(expected.autoCompleteSet.map(normalizeAutocompleteTerm), 'name');
  }
  return out;
}

function normalizeActualContext(context: AutoCompleteContext): Record<string, unknown> {
  const out: Record<string, unknown> = { ...context };
  if (context.endpoint && typeof context.endpoint.id === 'string') {
    out.endpoint = context.endpoint.id;
  }
  if (context.autoCompleteSet) {
    out.autoCompleteSet = _.sortBy(context.autoCompleteSet, 'name');
  }
  return out;
}

function normalizeAutocompleteTerm(term: AutocompleteTerm): ResultTerm {
  if (
    term === null ||
    typeof term === 'string' ||
    typeof term === 'boolean' ||
    typeof term === 'number'
  ) {
    return { name: term };
  }
  return term;
}
