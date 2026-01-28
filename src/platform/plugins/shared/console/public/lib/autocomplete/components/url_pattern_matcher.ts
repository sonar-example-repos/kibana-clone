/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import _ from 'lodash';

import { FullRequestComponent } from './full_request_component';

import type { AutoCompleteContext, AutocompleteComponentLike, AutocompleteTerm } from '../types';

import { AcceptEndpointComponent } from './accept_endpoint_component';
import { ConstantComponent } from './constant_component';
import { ListComponent } from './list_component';
import { SharedComponent } from './shared_component';
import { SimpleParamComponent } from './simple_param_component';

type HttpMethod = 'HEAD' | 'GET' | 'PUT' | 'POST' | 'DELETE' | 'PATCH';

type ParametrizedFactory = (part: string, parent: SharedComponent) => SharedComponent | undefined;

export interface ParametrizedComponentFactories {
  getComponent: (name: string) => ParametrizedFactory | undefined;
}

interface MethodRoot {
  rootComponent: SharedComponent;
  parametrizedComponentFactories: ParametrizedComponentFactories;
}

type EndpointDescription = NonNullable<AutoCompleteContext['endpoint']> & {
  id: string;
  methods: string[];
  template?: string;
  url_components?: Record<string, unknown>;
};

export class UrlPatternMatcher {
  declare HEAD: MethodRoot;
  declare GET: MethodRoot;
  declare PUT: MethodRoot;
  declare POST: MethodRoot;
  declare DELETE: MethodRoot;
  declare PATCH: MethodRoot;

  // This is not really a component, just a handy container to make iteration logic simpler
  constructor(parametrizedComponentFactories?: ParametrizedComponentFactories) {
    // We'll group endpoints by the methods which are attached to them,
    // to avoid suggesting endpoints that are incompatible with the
    // method that the user has entered.
    (['HEAD', 'GET', 'PUT', 'POST', 'DELETE', 'PATCH'] as const).forEach((method) => {
      this[method] = {
        rootComponent: new SharedComponent('ROOT'),
        parametrizedComponentFactories: parametrizedComponentFactories ?? {
          getComponent: () => undefined,
        },
      };
    });
  }

  addEndpoint(pattern: string, endpoint: EndpointDescription): void {
    endpoint.methods.forEach((methodValue) => {
      const method = methodValue as HttpMethod;
      let activeComponent = this[method].rootComponent;
      let c: SharedComponent;

      if (endpoint.template) {
        new FullRequestComponent(`${pattern}[body]`, activeComponent, endpoint.template);
      }

      const endpointComponents = endpoint.url_components || {};
      const partList = pattern.split('/');

      _.each(partList, (part, partIndex) => {
        if (part.search(/^{.+}$/) >= 0) {
          part = part.substring(1, part.length - 1);

          const existing = activeComponent.getComponent(part);
          if (existing instanceof SharedComponent) {
            // we already have something for this, reuse
            activeComponent = existing;
            return;
          }

          // a new path, resolve.
          const endpointComponentConfig = endpointComponents[part];
          if (endpointComponentConfig) {
            // endpoint specific. Support list
            if (Array.isArray(endpointComponentConfig)) {
              c = new ListComponent(
                part,
                endpointComponentConfig as AutocompleteTerm[],
                activeComponent
              );
            } else if (
              _.isObject(endpointComponentConfig) &&
              (endpointComponentConfig as { type?: unknown }).type === 'list'
            ) {
              const cfg = endpointComponentConfig as {
                list: AutocompleteTerm[];
                multiValued?: boolean;
                allow_non_valid?: boolean;
              };
              c = new ListComponent(
                part,
                cfg.list,
                activeComponent,
                cfg.multiValued,
                cfg.allow_non_valid
              );
            } else {
              // eslint-disable-next-line no-console
              console.warn('incorrectly configured url component ', part, ' in endpoint', endpoint);
              c = new SharedComponent(part);
            }
          } else {
            const factory = this[method].parametrizedComponentFactories.getComponent(part);
            if (factory) {
              const created = factory(part, activeComponent);
              if (!created) {
                throw new Error(`Expected parametrized factory '${part}' to return a component`);
              }
              c = created;
            } else {
              // just accept whatever with not suggestions
              c = new SimpleParamComponent(part, activeComponent);
            }
          }

          activeComponent = c;
        } else {
          // not pattern
          let lookAhead = part;
          let s: string;

          for (partIndex++; partIndex < partList.length; partIndex++) {
            s = partList[partIndex];
            if (s.indexOf('{') >= 0) {
              break;
            }
            lookAhead += `/${s}`;
          }

          const existing = activeComponent.getComponent(part);
          if (existing instanceof ConstantComponent) {
            activeComponent = existing;
            existing.addOption(lookAhead);
          } else {
            c = new ConstantComponent(part, activeComponent, lookAhead);
            activeComponent = c;
          }
        }
      });

      // mark end of endpoint path
      new AcceptEndpointComponent(endpoint, activeComponent);
    });
  }

  getTopLevelComponents = (method?: string | null): AutocompleteComponentLike[] => {
    if (!method) return [];

    switch (method) {
      case 'HEAD':
        return this.HEAD.rootComponent.next;
      case 'GET':
        return this.GET.rootComponent.next;
      case 'PUT':
        return this.PUT.rootComponent.next;
      case 'POST':
        return this.POST.rootComponent.next;
      case 'DELETE':
        return this.DELETE.rootComponent.next;
      case 'PATCH':
        return this.PATCH.rootComponent.next;
      default:
        return [];
    }
  };
}
