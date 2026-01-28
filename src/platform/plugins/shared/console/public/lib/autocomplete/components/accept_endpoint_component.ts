/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import _ from 'lodash';

import type {
  AutoCompleteContext,
  AutocompleteEditor,
  AutocompleteMatch,
  AutocompleteMatchResult,
  AutocompleteToken,
} from '../types';

import { SharedComponent } from './shared_component';

export const URL_PATH_END_MARKER = '__url_path_end__';

type EndpointDescription = NonNullable<AutoCompleteContext['endpoint']> & { id: string };

export class AcceptEndpointComponent extends SharedComponent {
  endpoint: EndpointDescription;

  constructor(endpoint: EndpointDescription, parent: SharedComponent) {
    super(endpoint.id, parent);
    this.endpoint = endpoint;
  }

  override match(
    token: AutocompleteToken,
    context: AutoCompleteContext,
    editor: AutocompleteEditor
  ): AutocompleteMatch {
    if (token !== URL_PATH_END_MARKER) {
      return null;
    }

    if (
      this.endpoint.methods &&
      (!context.method || -1 === _.indexOf(this.endpoint.methods, context.method))
    ) {
      return null;
    }

    const base = super.match(token, context, editor);
    if (!base) {
      return base;
    }

    const r: AutocompleteMatchResult = base;
    r.context_values ??= {};
    r.context_values.endpoint = this.endpoint;

    if (_.isNumber(this.endpoint.priority)) {
      r.priority = this.endpoint.priority;
    }

    return r;
  }
}
