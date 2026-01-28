/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { JsonValue as KbnJsonValue } from '@kbn/utility-types';

import type { MonacoEditorActionsProvider } from '../../application/containers/editor/monaco_editor_actions_provider';
import type { CoreEditor, Range, Token } from '../../types';

export type JsonValue = KbnJsonValue;

export interface ResultTerm {
  meta?: string;
  context?: AutoCompleteContext;
  insertValue?: string;
  name?: string | boolean | number | null;
  /**
   * Optional snippet to be inserted by the editor.
   *
   * Used by some autocomplete components to provide full-request templates.
   */
  snippet?: string;
  value?: string;
  score?: number;
  template?: JsonValue;
}

export interface DataAutoCompleteRulesOneOf {
  __condition?: {
    lines_regex: string;
  };
  __template: JsonValue;
  [key: string]: unknown;
}

export type AutocompleteEditor = CoreEditor | MonacoEditorActionsProvider | undefined;

/**
 * Tokens consumed by the legacy autocomplete engine while walking a token path.
 *
 * Today these are derived from URL/body tokenization logic and are always strings (or string arrays for
 * multi-valued tokens).
 */
export type AutocompleteToken = string | string[];

export type AutocompleteTerm = ResultTerm | string | boolean | number | null;

export interface AutocompleteMatchResult {
  next: AutocompleteComponentLike[];
  context_values?: Record<string, unknown>;
  priority?: number;
}

export type AutocompleteMatch = AutocompleteMatchResult | null | false;

/**
 * The minimal interface the legacy autocomplete engine expects components to implement.
 *
 * This is intentionally structural (not class-based) to avoid type cycles between the engine
 * and the concrete component implementations.
 */
export interface AutocompleteComponentLike {
  name: string;
  next?: AutocompleteComponentLike[];
  getTerms: (context: AutoCompleteContext, editor: AutocompleteEditor) => AutocompleteTerm[] | null;
  match: (
    token: AutocompleteToken,
    context: AutoCompleteContext,
    editor: AutocompleteEditor
  ) => AutocompleteMatch;
}

export interface AutoCompleteContext {
  autoCompleteSet?: null | ResultTerm[];
  /**
   * Stores a state for async results, e.g. fields suggestions based on the mappings definition.
   */
  asyncResultsState?: {
    isLoading: boolean;
    lastFetched: number | null;
    results: Promise<ResultTerm[]>;
  };
  endpoint?: null | {
    paramsAutocomplete: {
      getTopLevelComponents: (method?: string | null) => AutocompleteComponentLike[];
    };
    bodyAutocompleteRootComponents: AutocompleteComponentLike[];
    id?: string;
    documentation?: string;
    methods?: string[];
    priority?: number;
    patterns?: string[];
    data_autocomplete_rules?: Record<string, unknown> | null;
  };
  urlPath?: null | unknown;
  urlParamsTokenPath?: Array<Record<string, string>> | null;
  method?: string | null;
  token?: Token;
  activeScheme?: unknown;
  replacingToken?: boolean;
  rangeToReplace?: Range;
  autoCompleteType?: null | string;
  editor?: CoreEditor | MonacoEditorActionsProvider;

  /**
   * The tokenized user input that prompted the current autocomplete at the cursor. This can be out of sync with
   * the input that is currently being displayed in the editor.
   */
  createdWithToken?: Token | null;

  /**
   * The tokenized user input that is currently being displayed at the cursor in the editor when the user accepted
   * the autocomplete suggestion.
   */
  updatedForToken?: Token | null;

  addTemplate?: boolean;
  prefixToAdd?: string;
  suffixToAdd?: string;
  textBoxPosition?: { lineNumber: number; column: number };
  urlTokenPath?: string[];
  otherTokenValues?: string | string[];
  requestStartRow?: number | null;
  bodyTokenPath?: string[] | null;
  endpointComponentResolver?: (endpoint: string) => AutocompleteComponentLike[];
  globalComponentResolver?: (
    term: string,
    throwOnMissing?: boolean
  ) => AutocompleteComponentLike[] | undefined;
  documentation?: string;

  /**
   * The legacy autocomplete engine stores additional dynamic context values under arbitrary keys
   * (e.g. `indices`, `fields`, etc). We model that here explicitly to avoid unsafe type assertions.
   */
  [key: string]: unknown;
}
