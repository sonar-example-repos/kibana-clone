/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { httpServiceMock } from '@kbn/core-http-browser-mocks';

import type { AutoCompleteContext } from '../autocomplete/types';
import type { Field } from './types';

import { setAutocompleteInfo, AutocompleteInfo } from '../../services';
import { expandAliases } from './expand_aliases';
import { SettingsMock } from '../../services/settings.mock';
import { StorageMock } from '../../services/storage.mock';

function compareFieldsByName(f1: Field, f2: Field) {
  if (f1.name < f2.name) return -1;
  if (f1.name > f2.name) return 1;
  return 0;
}

function field(name: string, type: string = 'string'): Field {
  return { name, type };
}

describe('Autocomplete entities', () => {
  let autocompleteInfo: AutocompleteInfo;
  let settingsMock: SettingsMock;
  let httpMock: ReturnType<typeof httpServiceMock.createSetupContract>;

  beforeEach(() => {
    autocompleteInfo = new AutocompleteInfo();
    setAutocompleteInfo(autocompleteInfo);

    httpMock = httpServiceMock.createSetupContract();
    const storage = new StorageMock({}, 'test');
    settingsMock = new SettingsMock(storage);

    autocompleteInfo.mapping.setup(httpMock, settingsMock);
  });

  afterEach(() => {
    autocompleteInfo.clear();
    setAutocompleteInfo(new AutocompleteInfo());
  });

  describe('Mappings', () => {
    describe('When fields autocomplete is disabled', () => {
      beforeEach(() => {
        settingsMock.getAutocomplete.mockReturnValue({ fields: false });
      });

      test('does not return any suggestions', () => {
        const mappings = {
          index: {
            properties: {
              first_name: {
                type: 'string',
                index: 'analyzed',
                path: 'just_name',
                fields: {
                  any_name: { type: 'string', index: 'analyzed' },
                },
              },
            },
          },
        };

        autocompleteInfo.mapping.loadMappings(mappings);

        expect(autocompleteInfo.mapping.getMappings('index').sort(compareFieldsByName)).toEqual([]);
        expect(httpMock.get).not.toHaveBeenCalled();
      });
    });

    describe('When fields autocomplete is enabled', () => {
      beforeEach(() => {
        settingsMock.getAutocomplete.mockReturnValue({ fields: true });
        httpMock.get.mockReturnValue(
          Promise.resolve({
            mappings: { index: { mappings: { properties: { '@timestamp': { type: 'date' } } } } },
          })
        );
      });

      test('attempts to fetch mappings if not loaded', async () => {
        const autoCompleteContext: AutoCompleteContext = {};
        let loadingIndicator: boolean | undefined;

        autocompleteInfo.mapping.isLoading$.subscribe((v) => {
          loadingIndicator = v;
        });

        // act
        autocompleteInfo.mapping.getMappings('index', [], autoCompleteContext);

        expect(autoCompleteContext.asyncResultsState?.isLoading).toBe(true);
        expect(loadingIndicator).toBe(true);
        expect(httpMock.get).toHaveBeenCalled();

        const asyncState = autoCompleteContext.asyncResultsState;
        if (!asyncState) {
          throw new Error('Expected asyncResultsState to be set');
        }
        const fields = await asyncState.results;

        expect(loadingIndicator).toBe(false);
        expect(autoCompleteContext.asyncResultsState?.isLoading).toBe(false);
        expect(fields).toEqual([{ name: '@timestamp', type: 'date' }]);
      });

      test('caches mappings for wildcard requests', async () => {
        httpMock.get.mockReturnValue(
          Promise.resolve({
            mappings: {
              'my-index-01': { mappings: { properties: { '@timestamp': { type: 'date' } } } },
              'my-index-02': { mappings: { properties: { name: { type: 'keyword' } } } },
            },
          })
        );

        const autoCompleteContext: AutoCompleteContext = {};

        autocompleteInfo.mapping.getMappings('my-index*', [], autoCompleteContext);

        const asyncState = autoCompleteContext.asyncResultsState;
        if (!asyncState) {
          throw new Error('Expected asyncResultsState to be set');
        }
        const fields = await asyncState.results;

        const expectedResult = [
          { name: '@timestamp', type: 'date' },
          { name: 'name', type: 'keyword' },
        ];

        expect(fields).toEqual(expectedResult);
        expect(autocompleteInfo.mapping.getMappings('my-index*', [], autoCompleteContext)).toEqual(
          expectedResult
        );
      });

      test('returns mappings for data streams', () => {
        autocompleteInfo.dataStream.loadDataStreams({
          data_streams: [
            { name: 'test_index1', indices: [{ index_name: '.ds-index-1' }] },
            {
              name: 'test_index3',
              indices: [{ index_name: '.ds-index-3' }, { index_name: '.ds-index-4' }],
            },
          ],
        });

        const mappings = {
          '.ds-index-3': {
            properties: {
              first_name: {
                type: 'string',
                index: 'analyzed',
                path: 'just_name',
                fields: {
                  any_name: { type: 'string', index: 'analyzed' },
                },
              },
              last_name: {
                type: 'string',
                index: 'no',
                fields: {
                  raw: { type: 'string', index: 'analyzed' },
                },
              },
            },
          },
        };

        autocompleteInfo.mapping.loadMappings(mappings);

        const result = autocompleteInfo.mapping.getMappings('test_index3', []);
        expect(result).toEqual([
          { name: 'first_name', type: 'string' },
          { name: 'any_name', type: 'string' },
          { name: 'last_name', type: 'string' },
          { name: 'last_name.raw', type: 'string' },
        ]);
      });

      test('Multi fields 1.0 style', () => {
        const mappings = {
          index: {
            properties: {
              first_name: {
                type: 'string',
                index: 'analyzed',
                path: 'just_name',
                fields: {
                  any_name: { type: 'string', index: 'analyzed' },
                },
              },
              last_name: {
                type: 'string',
                index: 'no',
                fields: {
                  raw: { type: 'string', index: 'analyzed' },
                },
              },
            },
          },
        };

        autocompleteInfo.mapping.loadMappings(mappings);

        expect(autocompleteInfo.mapping.getMappings('index').sort(compareFieldsByName)).toEqual([
          field('any_name', 'string'),
          field('first_name', 'string'),
          field('last_name', 'string'),
          field('last_name.raw', 'string'),
        ]);
      });

      test('Simple fields', () => {
        const mappings = {
          index: {
            properties: {
              str: { type: 'string' },
              number: { type: 'int' },
            },
          },
        };

        autocompleteInfo.mapping.loadMappings(mappings);

        expect(autocompleteInfo.mapping.getMappings('index').sort(compareFieldsByName)).toEqual([
          field('number', 'int'),
          field('str', 'string'),
        ]);
      });

      test('Simple fields - 1.0 style', () => {
        const mappings = {
          index: {
            mappings: {
              properties: {
                str: { type: 'string' },
                number: { type: 'int' },
              },
            },
          },
        };

        autocompleteInfo.mapping.loadMappings(mappings);

        expect(autocompleteInfo.mapping.getMappings('index').sort(compareFieldsByName)).toEqual([
          field('number', 'int'),
          field('str', 'string'),
        ]);
      });

      test('Nested fields', () => {
        const mappings = {
          index: {
            properties: {
              person: {
                type: 'object',
                properties: {
                  name: {
                    properties: {
                      first_name: { type: 'string' },
                      last_name: { type: 'string' },
                    },
                  },
                  sid: { type: 'string', index: 'not_analyzed' },
                },
              },
              message: { type: 'string' },
            },
          },
        };

        autocompleteInfo.mapping.loadMappings(mappings);

        expect(autocompleteInfo.mapping.getMappings('index', []).sort(compareFieldsByName)).toEqual(
          [
            field('message'),
            field('person.name.first_name'),
            field('person.name.last_name'),
            field('person.sid'),
          ]
        );
      });

      test('Enabled fields', () => {
        const mappings = {
          index: {
            properties: {
              person: {
                type: 'object',
                properties: {
                  name: {
                    type: 'object',
                    enabled: false,
                  },
                  sid: { type: 'string', index: 'not_analyzed' },
                },
              },
              message: { type: 'string' },
            },
          },
        };

        autocompleteInfo.mapping.loadMappings(mappings);

        expect(autocompleteInfo.mapping.getMappings('index', []).sort(compareFieldsByName)).toEqual(
          [field('message'), field('person.sid')]
        );
      });

      test('Path tests', () => {
        const mappings = {
          index: {
            properties: {
              name1: {
                type: 'object',
                path: 'just_name',
                properties: {
                  first1: { type: 'string' },
                  last1: { type: 'string', index_name: 'i_last_1' },
                },
              },
              name2: {
                type: 'object',
                path: 'full',
                properties: {
                  first2: { type: 'string' },
                  last2: { type: 'string', index_name: 'i_last_2' },
                },
              },
            },
          },
        };

        autocompleteInfo.mapping.loadMappings(mappings);

        expect(autocompleteInfo.mapping.getMappings().sort(compareFieldsByName)).toEqual([
          field('first1'),
          field('i_last_1'),
          field('name2.first2'),
          field('name2.i_last_2'),
        ]);
      });

      test('Use index_name tests', () => {
        const mappings = {
          index: {
            properties: {
              last1: { type: 'string', index_name: 'i_last_1' },
            },
          },
        };

        autocompleteInfo.mapping.loadMappings(mappings);

        expect(autocompleteInfo.mapping.getMappings().sort(compareFieldsByName)).toEqual([
          field('i_last_1'),
        ]);
      });
    });
  });

  describe('Aliases', () => {
    test('Aliases', () => {
      autocompleteInfo.alias.loadAliases(
        {
          test_index1: {
            aliases: {
              alias1: {},
            },
          },
          test_index2: {
            aliases: {
              alias2: {
                filter: {
                  term: {
                    FIELD: 'VALUE',
                  },
                },
              },
              alias1: {},
            },
          },
        },
        autocompleteInfo.mapping
      );

      const mappings = {
        test_index1: {
          mappings: {
            properties: {
              last1: { type: 'string', index_name: 'i_last_1' },
            },
          },
        },
        test_index2: {
          mappings: {
            properties: {
              last1: { type: 'string', index_name: 'i_last_1' },
            },
          },
        },
      };

      autocompleteInfo.mapping.loadMappings(mappings);

      expect(autocompleteInfo.alias.getIndices(true, autocompleteInfo.mapping).sort()).toEqual([
        '_all',
        'alias1',
        'alias2',
        'test_index1',
        'test_index2',
      ]);

      expect(autocompleteInfo.alias.getIndices(false, autocompleteInfo.mapping).sort()).toEqual([
        'test_index1',
        'test_index2',
      ]);

      const expanded = expandAliases(['alias1', 'test_index2']);
      const expandedList = Array.isArray(expanded) ? expanded : [expanded];
      expect(expandedList.sort()).toEqual(['test_index1', 'test_index2']);
      expect(expandAliases('alias2')).toEqual('test_index2');
    });
  });

  describe('Templates', () => {
    test('legacy templates, index templates, component templates', () => {
      autocompleteInfo.legacyTemplate.loadTemplates({
        test_index1: { order: 0 },
        test_index2: { order: 0 },
        test_index3: { order: 0 },
      });

      autocompleteInfo.indexTemplate.loadTemplates({
        index_templates: [
          { name: 'test_index1' },
          { name: 'test_index2' },
          { name: 'test_index3' },
        ],
      });

      autocompleteInfo.componentTemplate.loadTemplates({
        component_templates: [
          { name: 'test_index1' },
          { name: 'test_index2' },
          { name: 'test_index3' },
        ],
      });

      const expectedResult = ['test_index1', 'test_index2', 'test_index3'];

      expect(autocompleteInfo.legacyTemplate.getTemplates()).toEqual(expectedResult);
      expect(autocompleteInfo.indexTemplate.getTemplates()).toEqual(expectedResult);
      expect(autocompleteInfo.componentTemplate.getTemplates()).toEqual(expectedResult);
    });
  });

  describe('Data streams', () => {
    test('data streams', () => {
      autocompleteInfo.dataStream.loadDataStreams({
        data_streams: [
          { name: 'test_index1', indices: [{ index_name: '.ds-index-1' }] },
          { name: 'test_index2', indices: [{ index_name: '.ds-index-2' }] },
          {
            name: 'test_index3',
            indices: [{ index_name: '.ds-index-3' }, { index_name: '.ds-index-4' }],
          },
        ],
      });

      const expectedResult = ['test_index1', 'test_index2', 'test_index3'];
      expect(autocompleteInfo.dataStream.getDataStreams()).toEqual(expectedResult);
      expect(autocompleteInfo.dataStream.perDataStreamIndices).toEqual({
        test_index1: ['.ds-index-1'],
        test_index2: ['.ds-index-2'],
        test_index3: ['.ds-index-3', '.ds-index-4'],
      });
    });

    test('extracts indices from a data stream', () => {
      autocompleteInfo.dataStream.loadDataStreams({
        data_streams: [
          { name: 'test_index1', indices: [{ index_name: '.ds-index-1' }] },
          {
            name: 'test_index3',
            indices: [{ index_name: '.ds-index-3' }, { index_name: '.ds-index-4' }],
          },
        ],
      });

      expect(expandAliases('test_index1')).toEqual('.ds-index-1');
      expect(expandAliases('test_index3')).toEqual(['.ds-index-3', '.ds-index-4']);
    });
  });
});
