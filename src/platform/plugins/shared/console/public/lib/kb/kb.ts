/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import _ from 'lodash';

import type { HttpSetup } from '@kbn/core/public';

import { API_BASE_PATH } from '../../../common/constants';
import { isRecord } from '../../../common/utils/record_utils';
import {
  ComponentTemplateAutocompleteComponent,
  DataStreamAutocompleteComponent,
  FieldAutocompleteComponent,
  IndexAutocompleteComponent,
  IndexTemplateAutocompleteComponent,
  LegacyTemplateAutocompleteComponent,
  ListComponent,
} from '../autocomplete/components';

import { Api } from './api';
import type {
  BodyDescription,
  ParametrizedComponentFactories,
} from '../autocomplete/body_completer';
import type { JsonValue } from '../autocomplete/types';
import type { ParametrizedComponentFactories as UrlParametrizedComponentFactories } from '../autocomplete/components/url_pattern_matcher';
import type { SharedComponent } from '../autocomplete/components/shared_component';

type ParamFactory = (
  name: string,
  parent: SharedComponent | undefined,
  template?: JsonValue
) => SharedComponent;

let ACTIVE_API = new Api();
let apiLoaded = false;

const factories: Record<string, ParamFactory | undefined> = {
  index: (name, parent) => new IndexAutocompleteComponent(name, parent, true),
  fields: (name, parent) => new FieldAutocompleteComponent(name, parent, true),
  field: (name, parent) => new FieldAutocompleteComponent(name, parent, false),
  // legacy index templates
  template: (name, parent) => new LegacyTemplateAutocompleteComponent(name, parent),
  // composable index templates
  index_template: (name, parent) => new IndexTemplateAutocompleteComponent(name, parent),
  component_template: (name, parent) => new ComponentTemplateAutocompleteComponent(name, parent),
  data_stream: (name, parent) => new DataStreamAutocompleteComponent(name, parent),
};

const defaultBodyParametrizedComponentFactories: ParametrizedComponentFactories = {
  getComponent: (name: string) => {
    const factory = factories[name];
    if (factory) return factory;
    return undefined;
  },
};

const defaultUrlParametrizedComponentFactories: UrlParametrizedComponentFactories = {
  getComponent: (name: string) => {
    const factory = factories[name];
    if (!factory) return undefined;
    return (part, parent) => factory(part, parent);
  },
};

export function getUnmatchedEndpointComponents() {
  return ACTIVE_API.getUnmatchedEndpointComponents();
}

export function getEndpointDescriptionByEndpoint(endpoint: string) {
  return ACTIVE_API.getEndpointDescriptionByEndpoint(endpoint);
}

export function getEndpointBodyCompleteComponents(endpoint: string) {
  const desc = getEndpointDescriptionByEndpoint(endpoint);
  if (!desc) {
    throw new Error(`failed to resolve endpoint ['${endpoint}']`);
  }
  return desc.bodyAutocompleteRootComponents;
}

export function getTopLevelUrlCompleteComponents(method: string) {
  return ACTIVE_API.getTopLevelUrlCompleteComponents(method);
}

export function getGlobalAutocompleteComponents(term: string, throwOnMissing?: boolean) {
  return ACTIVE_API.getGlobalAutocompleteComponents(term, throwOnMissing);
}

function loadApisFromJson(
  json: unknown,
  urlParametrizedComponentFactories?: UrlParametrizedComponentFactories,
  bodyParametrizedComponentFactories?: ParametrizedComponentFactories
) {
  try {
    const urlFactories =
      urlParametrizedComponentFactories ?? defaultUrlParametrizedComponentFactories;
    const bodyFactories =
      bodyParametrizedComponentFactories ?? defaultBodyParametrizedComponentFactories;

    const api = new Api(urlFactories, bodyFactories);
    const names: string[] = [];

    _.each(json as any, (apiJson: any, name: unknown) => {
      names.unshift(String(name));
      _.each((apiJson as any).globals || {}, (globalJson: unknown, globalName: unknown) => {
        api.addGlobalAutocompleteRules(String(globalName), globalJson);
      });

      _.each((apiJson as any).endpoints || {}, (endpointJson: unknown, endpointName: unknown) => {
        api.addEndpointDescription(String(endpointName), endpointJson);
      });
    });

    api.name = names.join(',');
    return api;
  } catch (e: unknown) {
    // eslint-disable-next-line no-console
    console.error(e);
  }
}

function setActiveApi(api: Api | undefined) {
  if (!api) {
    return;
  }

  ACTIVE_API = api;
}

export async function loadActiveApi(http: Pick<HttpSetup, 'get'>) {
  // Only load the API data once
  if (apiLoaded) return;
  apiLoaded = true;

  try {
    const data = await http.get<Record<string, unknown>>(`${API_BASE_PATH}/api_server`);
    setActiveApi(loadApisFromJson(data));
  } catch (err: unknown) {
    const responseText = getResponseText(err) ?? 'unknown error';

    // eslint-disable-next-line no-console
    console.log(`failed to load API: ${responseText}`);

    // If we fail to load the API, clear this flag so it can be retried
    apiLoaded = false;
  }
}

export const _test = {
  loadApisFromJson,
  setActiveApi,
  globalUrlComponentFactories: defaultUrlParametrizedComponentFactories,
  // for test authors who want to provide ad-hoc rules
  ListComponent,
};

export type { BodyDescription };

function getResponseText(err: unknown): string | null {
  if (!isRecord(err)) return null;
  if (!('responseText' in err)) return null;
  const value = err.responseText;
  return typeof value === 'string' ? value : null;
}
