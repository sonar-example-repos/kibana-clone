/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import * as utils from '.';
import type { RequestResult } from '../../application/hooks/use_send_current_request/send_request';

describe('Utils class', () => {
  test('extract deprecation messages', () => {
    expect(
      utils.extractWarningMessages(
        '299 Elasticsearch-6.0.0-alpha1-SNAPSHOT-abcdef1 "this is a warning" "Mon, 27 Feb 2017 14:52:14 GMT"'
      )
    ).toEqual(['#! this is a warning']);
    expect(
      utils.extractWarningMessages(
        '299 Elasticsearch-6.0.0-alpha1-SNAPSHOT-abcdef1 "this is a warning"'
      )
    ).toEqual(['#! this is a warning']);

    expect(
      utils.extractWarningMessages(
        '299 Elasticsearch-6.0.0-alpha1-SNAPSHOT-abcdef1 "this is a warning" "Mon, 27 Feb 2017 14:52:14 GMT", 299 Elasticsearch-6.0.0-alpha1-SNAPSHOT-abcdef1 "this is a second warning" "Mon, 27 Feb 2017 14:52:14 GMT"'
      )
    ).toEqual(['#! this is a warning', '#! this is a second warning']);
    expect(
      utils.extractWarningMessages(
        '299 Elasticsearch-6.0.0-alpha1-SNAPSHOT-abcdef1 "this is a warning", 299 Elasticsearch-6.0.0-alpha1-SNAPSHOT-abcdef1 "this is a second warning"'
      )
    ).toEqual(['#! this is a warning', '#! this is a second warning']);

    expect(
      utils.extractWarningMessages(
        '299 Elasticsearch-6.0.0-alpha1-SNAPSHOT-abcdef1 "this is a warning, and it includes a comma" "Mon, 27 Feb 2017 14:52:14 GMT"'
      )
    ).toEqual(['#! this is a warning, and it includes a comma']);
    expect(
      utils.extractWarningMessages(
        '299 Elasticsearch-6.0.0-alpha1-SNAPSHOT-abcdef1 "this is a warning, and it includes a comma"'
      )
    ).toEqual(['#! this is a warning, and it includes a comma']);

    expect(
      utils.extractWarningMessages(
        '299 Elasticsearch-6.0.0-alpha1-SNAPSHOT-abcdef1 "this is a warning, and it includes an escaped backslash \\\\ and a pair of \\"escaped quotes\\"" "Mon, 27 Feb 2017 14:52:14 GMT"'
      )
    ).toEqual([
      '#! this is a warning, and it includes an escaped backslash \\ and a pair of "escaped quotes"',
    ]);
    expect(
      utils.extractWarningMessages(
        '299 Elasticsearch-6.0.0-alpha1-SNAPSHOT-abcdef1 "this is a warning, and it includes an escaped backslash \\\\ and a pair of \\"escaped quotes\\""'
      )
    ).toEqual([
      '#! this is a warning, and it includes an escaped backslash \\ and a pair of "escaped quotes"',
    ]);
  });

  test('unescape', () => {
    expect(utils.unescape('escaped backslash \\\\')).toEqual('escaped backslash \\');
    expect(utils.unescape('a pair of \\"escaped quotes\\"')).toEqual('a pair of "escaped quotes"');
    expect(utils.unescape('escaped quotes do not have to come in pairs: \\"')).toEqual(
      'escaped quotes do not have to come in pairs: "'
    );
  });

  test('split on unquoted comma followed by space', () => {
    expect(utils.splitOnUnquotedCommaSpace('a, b')).toEqual(['a', 'b']);
    expect(utils.splitOnUnquotedCommaSpace('a,b, c')).toEqual(['a,b', 'c']);
    expect(utils.splitOnUnquotedCommaSpace('"a, b"')).toEqual(['"a, b"']);
    expect(utils.splitOnUnquotedCommaSpace('"a, b", c')).toEqual(['"a, b"', 'c']);
    expect(utils.splitOnUnquotedCommaSpace('"a, b\\", c"')).toEqual(['"a, b\\", c"']);
    expect(utils.splitOnUnquotedCommaSpace(', a, b')).toEqual(['', 'a', 'b']);
    expect(utils.splitOnUnquotedCommaSpace('a, b, ')).toEqual(['a', 'b', '']);
    expect(utils.splitOnUnquotedCommaSpace('\\"a, b", "c, d\\", e", f"')).toEqual([
      '\\"a',
      'b", "c',
      'd\\"',
      'e", f"',
    ]);
  });

  describe('formatRequestBodyDoc', () => {
    const tests: Array<{ source: string[]; indent: boolean; assert: string[] }> = [
      {
        source: ['{\n  "test": {}\n}'],
        indent: false,
        assert: ['{"test":{}}'],
      },
      {
        source: ['{"test":{}}'],
        indent: true,
        assert: ['{\n  "test": {}\n}'],
      },
      {
        source: ['{\n  "test": """a\n  b"""\n}'],
        indent: false,
        assert: ['{"test":"a\\n  b"}'],
      },
      {
        source: ['{"test":"a\\n  b"}'],
        indent: true,
        assert: ['{\n  "test": """a\n  b"""\n}'],
      },
    ];

    tests.forEach(({ source, indent, assert }, id) => {
      test(`Test ${id}`, () => {
        const formattedData = utils.formatRequestBodyDoc(source, indent);
        expect(formattedData.data).toEqual(assert);
      });
    });
  });

  describe('hasComments', () => {
    const runCommentTests = (tests: Array<{ source: string; assert: boolean }>) => {
      tests.forEach(({ source, assert }) => {
        test(`\n${source}`, () => {
          const hasComments = utils.hasComments(source);
          expect(hasComments).toEqual(assert);
        });
      });
    };

    describe('match single line comments', () => {
      runCommentTests([
        { source: '{\n  "test": {\n   // "f": {}\n   "a": "b"\n  }\n}', assert: true },
        {
          source: '{\n  "test": {\n   "a": "b",\n   "f": {\n     # "b": {}\n   }\n  }\n}',
          assert: true,
        },
      ]);
    });

    describe('match multiline comments', () => {
      runCommentTests([
        { source: '{\n /* "test": {\n    "a": "b"\n  } */\n}', assert: true },
        {
          source:
            '{\n  "test": {\n    "a": "b",\n   /* "f": {\n      "b": {}\n    } */\n    "c": 1\n  }\n}',
          assert: true,
        },
      ]);
    });

    describe('ignore non-comment tokens', () => {
      runCommentTests([
        { source: '{"test":{"a":"b","f":{"b":{"c":{}}}}}', assert: false },
        {
          source: '{\n  "test": {\n    "a": "b",\n    "f": {\n      "b": {}\n    }\n  }\n}',
          assert: false,
        },
        { source: '{\n  "test": {\n    "f": {}\n  }\n}', assert: false },
      ]);
    });

    describe.skip('ignore comment tokens as values', () => {
      runCommentTests([
        { source: '{\n  "test": {\n    "f": "//"\n  }\n}', assert: false },
        { source: '{\n  "test": {\n    "f": "/* */"\n  }\n}', assert: false },
        { source: '{\n  "test": {\n    "f": "#"\n  }\n}', assert: false },
      ]);
    });

    describe.skip('ignore comment tokens as field names', () => {
      runCommentTests([
        { source: '{\n  "#": {\n    "f": {}\n  }\n}', assert: false },
        { source: '{\n  "//": {\n    "f": {}\n  }\n}', assert: false },
        { source: '{\n  "/* */": {\n    "f": {}\n  }\n}', assert: false },
      ]);
    });
  });

  test('get response with most severe status code', () => {
    expect(
      utils.getResponseWithMostSevereStatusCode([
        requestResult(500),
        requestResult(400),
        requestResult(200),
      ])
    ).toEqual(requestResult(500));

    expect(
      utils.getResponseWithMostSevereStatusCode([
        requestResult(0),
        requestResult(100),
        requestResult(201),
      ])
    ).toEqual(requestResult(201));

    expect(utils.getResponseWithMostSevereStatusCode(null)).toBe(undefined);
  });

  describe('replaceVariables', () => {
    interface RequestLike {
      url: string;
      method: string;
      data: string[];
    }
    interface VariableLike {
      id: string;
      name: string;
      value: string;
    }

    function variable(name: string, value: string): VariableLike {
      return { id: name, name, value };
    }

    function testVariables(data: RequestLike, variables: VariableLike, expected: RequestLike) {
      const result = utils.replaceVariables([data], [variables]);
      expect(result).toEqual([expected]);
    }

    it('should replace variables in url and body', () => {
      testVariables(
        { url: '${v1}/search', method: 'GET', data: ['{\n  "f": "${v1}"\n}'] },
        variable('v1', 'test'),
        {
          url: 'test/search',
          method: 'GET',
          data: ['{\n  "f": "test"\n}'],
        }
      );
    });

    describe('with booleans as field value', () => {
      testVariables(
        { url: 'test', method: 'GET', data: ['{\n  "f": "${v2}"\n}'] },
        variable('v2', 'true'),
        {
          url: 'test',
          method: 'GET',
          data: ['{\n  "f": true\n}'],
        }
      );
    });

    describe('with objects as field values', () => {
      testVariables(
        { url: 'test', method: 'GET', data: ['{\n  "f": "${v3}"\n}'] },
        variable('v3', '{"f": "test"}'),
        { url: 'test', method: 'GET', data: ['{\n  "f": {"f": "test"}\n}'] }
      );
    });

    describe('with arrays as field values', () => {
      testVariables(
        { url: 'test', method: 'GET', data: ['{\n  "f": "${v5}"\n}'] },
        variable('v5', '[{"t": "test"}]'),
        { url: 'test', method: 'GET', data: ['{\n  "f": [{"t": "test"}]\n}'] }
      );
    });

    describe('with numbers as field values', () => {
      testVariables(
        { url: 'test', method: 'GET', data: ['{\n  "f": "${v6}"\n}'] },
        variable('v6', '1'),
        { url: 'test', method: 'GET', data: ['{\n  "f": 1\n}'] }
      );
    });

    describe('with other variables as field values', () => {
      // Currently, variables embedded in other variables' values aren't replaced.
      // Once we build this feature, this test will fail and need to be updated.
      testVariables(
        { url: 'test', method: 'GET', data: ['{\n  "f": "${v4}"\n}'] },
        variable('v4', '{"v1": "${v1}", "v6": "${v6}"}'),
        {
          url: 'test',
          method: 'GET',
          data: ['{\n  "f": {"v1": "${v1}", "v6": "${v6}"}\n}'],
        }
      );
    });

    describe('with uuids as field values', () => {
      testVariables(
        { url: 'test', method: 'GET', data: ['{\n  "f": "${v7}"\n}'] },
        variable('v7', '9893617a-a08f-4e5c-bc41-95610dc2ded8'),
        {
          url: 'test',
          method: 'GET',
          data: ['{\n  "f": "9893617a-a08f-4e5c-bc41-95610dc2ded8"\n}'],
        }
      );
    });

    it('with illegal double quotes should not replace variables in body', () => {
      testVariables(
        { url: 'test/_doc/${v8}', method: 'GET', data: ['{\n  "f": ""${v8}""\n}'] },
        variable('v8', '0'),
        {
          url: 'test/_doc/0',
          method: 'GET',
          data: ['{\n  "f": ""${v8}""\n}'],
        }
      );
    });

    it('with heredoc triple quotes should replace variables as strings in body', () => {
      testVariables(
        { url: 'test/_doc/${v9}', method: 'GET', data: ['{\n  "f": """${v9}"""\n}'] },
        variable('v9', '0'),
        {
          url: 'test/_doc/0',
          method: 'GET',
          data: ['{\n  "f": """0"""\n}'],
        }
      );
    });

    it('with illegal quadruple quotes should not replace variables in body', () => {
      testVariables(
        { url: 'test/_doc/${v10}', method: 'GET', data: ['{\n  "f": """"${v10}""""\n}'] },
        variable('v10', '0'),
        {
          url: 'test/_doc/0',
          method: 'GET',
          data: ['{\n  "f": """"${v10}""""\n}'],
        }
      );
    });

    it('with escaped pre quote should not replace variables in body', () => {
      testVariables(
        { url: 'test/_doc/${v11}', method: 'GET', data: ['{\n  "f": "\\"${v11}"\n}'] },
        variable('v11', '0'),
        {
          url: 'test/_doc/0',
          method: 'GET',
          data: ['{\n  "f": "\\"${v11}"\n}'],
        }
      );
    });

    it('with escaped pre triple quotes should not replace variables in body', () => {
      testVariables(
        { url: 'test/_doc/${v12}', method: 'GET', data: ['{\n  "f": "\\"""${v12}"""\n}'] },
        variable('v12', '0'),
        {
          url: 'test/_doc/0',
          method: 'GET',
          data: ['{\n  "f": "\\"""${v12}"""\n}'],
        }
      );
    });

    it('should replace variables in bulk request', () => {
      testVariables(
        {
          url: '${v13}/_bulk',
          method: 'POST',
          data: [
            '{"index": {"_id": "0"}}',
            '{\n  "f": "${v13}"\n}',
            '{"index": {"_id": "1"}}',
            '{\n  "f": "${v13}"\n}',
          ],
        },
        variable('v13', 'test'),
        {
          url: 'test/_bulk',
          method: 'POST',
          data: [
            '{"index": {"_id": "0"}}',
            '{\n  "f": "test"\n}',
            '{"index": {"_id": "1"}}',
            '{\n  "f": "test"\n}',
          ],
        }
      );
    });
  });
});

function requestResult(statusCode: number): RequestResult {
  return {
    request: { data: '', method: 'GET', path: '' },
    response: {
      statusCode,
      statusText: '',
      timeMs: 0,
      contentType: 'unknown',
      value: null,
    },
  };
}
