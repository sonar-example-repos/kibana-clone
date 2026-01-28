/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import _ from 'lodash';

import type { AutoCompleteContext, ResultTerm } from '../autocomplete/types';
import type { TokenPathToken } from '../autocomplete/engine';

import { populateContext } from '../autocomplete/engine';

import * as kb from '.';
import { AutocompleteInfo, setAutocompleteInfo } from '../../services';

describe('Knowledge base', () => {
  let autocompleteInfo: AutocompleteInfo;

  beforeEach(() => {
    kb._test.setActiveApi(kb._test.loadApisFromJson({}));
    autocompleteInfo = new AutocompleteInfo();
    setAutocompleteInfo(autocompleteInfo);
    autocompleteInfo.mapping.clearMappings();
  });

  afterEach(() => {
    kb._test.setActiveApi(kb._test.loadApisFromJson({}));
    setAutocompleteInfo(new AutocompleteInfo());
  });

  const MAPPING = {
    index1: {
      mappings: {
        properties: {
          'field1.1.1': { type: 'string' },
          'field1.1.2': { type: 'long' },
        },
      },
    },
    index2: {
      mappings: {
        properties: {
          'field2.1.1': { type: 'string' },
          'field2.1.2': { type: 'string' },
        },
      },
    },
  };

  function testUrlContext(
    tokenPath: TokenPathToken[],
    otherTokenValues: string | string[],
    expectedContext: Record<string, unknown> & { autoCompleteSet?: Array<ResultTerm | string> }
  ) {
    const expected = normalizeExpectedContext(expectedContext);

    const context: AutoCompleteContext = { otherTokenValues };
    populateContext(
      tokenPath,
      context,
      undefined,
      Boolean(expected.autoCompleteSet),
      kb.getTopLevelUrlCompleteComponents('GET')
    );

    const actual = normalizeActualContext(context);
    delete actual.otherTokenValues;

    expect(actual).toEqual(expected);
  }

  function i(term: string): ResultTerm {
    return { name: term, meta: 'index' };
  }

  function indexTest(
    name: string,
    tokenPath: TokenPathToken[],
    otherTokenValues: string | string[],
    expectedContext: Record<string, unknown> & { autoCompleteSet?: Array<ResultTerm | string> }
  ) {
    test(name, () => {
      const testApi = kb._test.loadApisFromJson(
        {
          indexTest: {
            endpoints: {
              _multi_indices: {
                patterns: ['{index}/_multi_indices'],
              },
              _single_index: { patterns: ['{index}/_single_index'] },
              _no_index: {
                // testing default patters
                //  patterns: ["_no_index"]
              },
            },
          },
        },
        kb._test.globalUrlComponentFactories
      );

      kb._test.setActiveApi(testApi);

      autocompleteInfo.mapping.loadMappings(MAPPING);
      testUrlContext(tokenPath, otherTokenValues, expectedContext);
    });
  }

  indexTest('Index integration 1', [], [], {
    autoCompleteSet: ['_no_index', i('index1'), i('index2')],
  });

  indexTest(
    'Index integration 2',
    [],
    ['index1'],
    // still return _no_index as index1 is not committed to yet.
    { autoCompleteSet: ['_no_index', i('index2')] }
  );

  indexTest('Index integration 3', ['index1'], [], {
    indices: ['index1'],
    autoCompleteSet: ['_multi_indices', '_single_index'],
  });

  indexTest('Index integration 4', [['index1', 'index2']], [], {
    indices: ['index1', 'index2'],
    autoCompleteSet: ['_multi_indices', '_single_index'],
  });
});

function normalizeExpectedContext(
  expected: Record<string, unknown> & { autoCompleteSet?: Array<ResultTerm | string> }
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...expected };
  if (expected.autoCompleteSet) {
    out.autoCompleteSet = _.sortBy(expected.autoCompleteSet.map(normalizeTerm), 'name');
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

function normalizeTerm(t: ResultTerm | string): ResultTerm {
  return typeof t === 'string' ? { name: t } : t;
}
