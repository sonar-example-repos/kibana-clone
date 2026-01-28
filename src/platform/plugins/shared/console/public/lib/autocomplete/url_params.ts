/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import _ from 'lodash';

import { ListComponent, SharedComponent } from './components';
import { ParamComponent } from './url_params_param_component';

export class UrlParams {
  rootComponent: SharedComponent;

  constructor(description?: Record<string, unknown>, defaults?: Record<string, unknown>) {
    // This is not really a component, just a handy container to make iteration logic simpler
    this.rootComponent = new SharedComponent('ROOT');

    const resolvedDefaults =
      defaults ??
      ({
        pretty: '__flag__',
        format: ['json', 'yaml'],
        filter_path: '',
      } as const);

    const merged = _.clone(description || {});
    _.defaults(merged, resolvedDefaults);

    _.each(merged, (pDescription, param) => {
      const component = new ParamComponent(param, this.rootComponent, pDescription);
      if (Array.isArray(pDescription)) {
        new ListComponent(param, pDescription, component);
      } else if (pDescription === '__flag__') {
        new ListComponent(param, ['true', 'false'], component);
      }
    });
  }

  getTopLevelComponents() {
    return this.rootComponent.next;
  }
}
