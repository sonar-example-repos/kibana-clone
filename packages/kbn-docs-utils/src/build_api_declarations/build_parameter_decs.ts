/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { ParameterDeclaration, JSDoc } from 'ts-morph';
import { SyntaxKind } from 'ts-morph';
import { extractImportReferences } from './extract_import_refs';
import type { ApiDeclaration } from '../types';
import { buildApiDeclaration } from './build_api_declaration';
import { getJSDocParamComment } from './js_doc_utils';
import { buildBasicApiDeclaration } from './build_basic_api_declaration';
import type { BuildApiDecOpts } from './types';
import { buildApiId, getOptsForChild } from './utils';

const cleanName = (name: string) => name.replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();

const normalizeTight = (name: string) => name.replace(/[{}]/g, '').replace(/\s+/g, '').trim();

const applyParamComments = (
  apiDec: ApiDeclaration,
  jsDocs: JSDoc[] | undefined,
  path: string[]
) => {
  if (!jsDocs) return;

  const dotted = path.join('.');
  const cleaned = cleanName(path[0]);
  const cleanedPath = [cleaned, ...path.slice(1)].join('.');
  const tightPath = [normalizeTight(path[0]), ...path.slice(1).map(normalizeTight)].join('.');
  const baseCandidates = [dotted, cleanedPath, tightPath];
  if (path.length === 1) {
    baseCandidates.push(path[0]);
  }
  const candidates = Array.from(new Set(baseCandidates).values()).filter(Boolean);

  const comment = getJSDocParamComment(jsDocs, candidates);
  if (comment.length > 0) {
    apiDec.description = comment;
  }

  if (apiDec.children) {
    apiDec.children.forEach((child) => applyParamComments(child, jsDocs, [...path, child.label]));
  }
};

/**
 * A helper function to capture function parameters, whether it comes from an arrow function, a regular function or
 * a function type.
 */
export function buildApiDecsForParameters(
  params: ParameterDeclaration[],
  parentOpts: BuildApiDecOpts,
  jsDocs?: JSDoc[]
): ApiDeclaration[] {
  return params.reduce((acc, param, index) => {
    const id = buildApiId(`$${index + 1}`, parentOpts.id);
    const opts = {
      ...getOptsForChild(param, parentOpts),
      id,
    };

    opts.log.debug(`Getting parameter doc def for ${opts.name} of kind ${param.getKindName()}`);
    // Literal types are non primitives that aren't references to other types. We add them as a more
    // defined node, with children.
    // If we don't want the docs to be too deeply nested we could avoid this special handling.
    if (param.getTypeNode() && param.getTypeNode()!.getKind() === SyntaxKind.TypeLiteral) {
      const apiDec = buildApiDeclaration(param.getTypeNode()!, opts);
      applyParamComments(apiDec, jsDocs, [opts.name]);
      acc.push(apiDec);
    } else {
      const apiDec = buildBasicApiDeclaration(param, opts);
      applyParamComments(apiDec, jsDocs, [opts.name]);
      acc.push({
        ...apiDec,
        isRequired: param.getType().isNullable() === false,
        signature: extractImportReferences(param.getType().getText(), opts.plugins, opts.log),
      });
    }
    return acc;
  }, [] as ApiDeclaration[]);
}
