/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import _ from 'lodash';

import type { AutoCompleteContext, AutocompleteComponentLike } from '../autocomplete/types';
import type {
  BodyDescription,
  ParametrizedComponentFactories,
} from '../autocomplete/body_completer';
import type { ParametrizedComponentFactories as UrlParametrizedComponentFactories } from '../autocomplete/components/url_pattern_matcher';

import { UrlPatternMatcher } from '../autocomplete/components';
import { UrlParams } from '../autocomplete/url_params';
import { isRecord } from '../../../common/utils/record_utils';
import {
  compileBodyDescription,
  globalsOnlyAutocompleteComponents,
} from '../autocomplete/body_completer';

type EndpointDescription = NonNullable<AutoCompleteContext['endpoint']> & {
  id: string;
  patterns: string[];
  methods: string[];
  url_components?: Record<string, unknown>;
  url_params?: Record<string, unknown>;
  data_autocomplete_rules?: BodyDescription;
  template?: string;
  priority?: number;
};

export class Api {
  globalRules: Record<string, AutocompleteComponentLike[]> = Object.create(null);
  endpoints: Record<string, EndpointDescription> = Object.create(null);
  urlPatternMatcher: UrlPatternMatcher;
  globalBodyComponentFactories: ParametrizedComponentFactories;

  name = '';

  constructor(
    urlParametrizedComponentFactories: UrlParametrizedComponentFactories = {
      getComponent: () => undefined,
    },
    bodyParametrizedComponentFactories: ParametrizedComponentFactories = {
      getComponent: () => undefined,
    }
  ) {
    this.urlPatternMatcher = new UrlPatternMatcher(urlParametrizedComponentFactories);
    this.globalBodyComponentFactories = bodyParametrizedComponentFactories;
  }

  addGlobalAutocompleteRules(parentNode: string, rules: unknown): void {
    this.globalRules[parentNode] = compileBodyDescription(
      `GLOBAL.${parentNode}`,
      toBodyDescription(rules),
      this.globalBodyComponentFactories
    );
  }

  getGlobalAutocompleteComponents(term: string, throwOnMissing?: boolean) {
    const result = this.globalRules[term];
    if (_.isUndefined(result) && (throwOnMissing || _.isUndefined(throwOnMissing))) {
      throw new Error(`failed to resolve global components for ['${term}']`);
    }
    return result;
  }

  addEndpointDescription(endpoint: string, description: unknown): void {
    const base: EndpointDescription = {
      id: endpoint,
      patterns: [endpoint],
      methods: ['GET'],
      paramsAutocomplete: new UrlParams(undefined),
      bodyAutocompleteRootComponents: [],
    };

    const desc = isRecord(description) ? description : {};

    const patterns = asStringArray(desc.patterns) ?? base.patterns;
    const methods = asStringArray(desc.methods) ?? base.methods;

    const copiedDescription: EndpointDescription = {
      ...base,
      ...desc,
      id: endpoint,
      patterns,
      methods,
      url_components: isRecord(desc.url_components) ? desc.url_components : undefined,
      url_params: isRecord(desc.url_params) ? desc.url_params : undefined,
      template: typeof desc.template === 'string' ? desc.template : undefined,
      priority: typeof desc.priority === 'number' ? desc.priority : undefined,
    };

    _.each(copiedDescription.patterns, (p) => {
      this.urlPatternMatcher.addEndpoint(p, copiedDescription);
    });

    copiedDescription.paramsAutocomplete = new UrlParams(copiedDescription.url_params);
    copiedDescription.bodyAutocompleteRootComponents = compileBodyDescription(
      copiedDescription.id,
      toBodyDescription(copiedDescription.data_autocomplete_rules),
      this.globalBodyComponentFactories
    );

    this.endpoints[endpoint] = copiedDescription;
  }

  getEndpointDescriptionByEndpoint(endpoint: string) {
    return this.endpoints[endpoint];
  }

  getTopLevelUrlCompleteComponents(method?: string | null) {
    return this.urlPatternMatcher.getTopLevelComponents(method);
  }

  getUnmatchedEndpointComponents() {
    return globalsOnlyAutocompleteComponents();
  }

  clear(): void {
    this.endpoints = Object.create(null);
    this.globalRules = Object.create(null);
  }
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const strings = value.filter((v): v is string => typeof v === 'string');
  return strings.length ? strings : [];
}

function toBodyDescription(value: unknown): BodyDescription {
  if (Array.isArray(value)) return value.map(toBodyDescription);
  if (isRecord(value)) return value;
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null
  ) {
    return value;
  }
  return null;
}
