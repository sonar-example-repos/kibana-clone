/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { JSDoc, JSDocTag } from 'ts-morph';
import { Node } from 'ts-morph';
import type { TextWithLinks } from '../types';

/**
 * Extracts comments out of the node to use as the description.
 */
export function getCommentsFromNode(node: Node): TextWithLinks | undefined {
  let comments: TextWithLinks | undefined;
  const jsDocs = getJSDocs(node);
  if (jsDocs) {
    return getTextWithLinks(jsDocs.map((jsDoc) => jsDoc.getDescription()).join('\n'));
  } else {
    comments = getTextWithLinks(
      node
        .getLeadingCommentRanges()
        .map((c) => c.getText())
        .join('\n')
    );
  }

  return comments;
}

export function getJSDocs(node: Node): JSDoc[] | undefined {
  if (Node.isJSDocable(node)) {
    return node.getJsDocs();
  } else if (Node.isVariableDeclaration(node)) {
    const gparent = node.getParent()?.getParent();
    if (Node.isJSDocable(gparent)) {
      return gparent.getJsDocs();
    }
  }
}

export function getJSDocReturnTagComment(node: Node | JSDoc[]): TextWithLinks {
  const tags = getJSDocTags(node);
  const returnTag = tags.find((tag) => Node.isJSDocReturnTag(tag));
  if (returnTag) return getTextWithLinks(returnTag.getCommentText());
  return [];
}

export function getJSDocParamComment(node: Node | JSDoc[], name: string | string[]): TextWithLinks {
  const tags = getJSDocTags(node);
  const names = Array.isArray(name) ? name : [name];
  const normalizeName = (n: string) => n.replace(/[{}\s]/g, '');
  const normalizedNames = names.map(normalizeName);
  const paramTag = tags.find((tag) => {
    if (!Node.isJSDocParameterTag(tag)) return false;
    const normalizedTagName = normalizeName(tag.getName());
    return (
      normalizedNames.includes(normalizedTagName) ||
      normalizedNames.some((n) => normalizedTagName.endsWith(`.${n}`))
    );
  });
  if (paramTag) return getTextWithLinks(paramTag.getCommentText());

  // Fallback: parse raw JSDoc text for @param entries that ts-morph might not normalize
  const parseParamLines = (text: string) => {
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.replace(/^\s*\*\s?/, '');
      if (!trimmed.includes('@param')) continue;
      const compact = trimmed.trim();
      const body = compact.replace(/^@param\s+/, '');
      const parts = body.split(/\s+/);
      if (parts.length === 0) continue;
      let idx = 0;
      if (parts[0].startsWith('{')) {
        while (idx < parts.length && !parts[idx].endsWith('}')) idx += 1;
        idx += 1; // move past the type token
      }
      const nameToken = parts[idx];
      if (!nameToken) {
        continue;
      }
      const commentText = parts.slice(idx + 1).join(' ');
      const rawName = normalizeName(nameToken);
      if (
        normalizedNames.includes(rawName) ||
        normalizedNames.some((n) => rawName.endsWith(`.${n}`))
      ) {
        return getTextWithLinks(commentText.trim());
      }
    }
  };

  const jsDocs = node instanceof Array ? node : getJSDocs(node);
  if (jsDocs) {
    for (const jsDoc of jsDocs) {
      const parsed = parseParamLines(jsDoc.getText());
      if (parsed) return parsed;
    }
  }

  // Final fallback: scan leading comments for @param tags
  if (!(node instanceof Array) && node.getLeadingCommentRanges().length > 0) {
    const leadingText = node
      .getLeadingCommentRanges()
      .map((c) => c.getText())
      .join('\n');
    const parsed = parseParamLines(leadingText);
    if (parsed) {
      return parsed;
    }
  }
  return [];
}

export function getJSDocTags(node: Node | JSDoc[]): JSDocTag[] {
  const jsDocs = node instanceof Array ? node : getJSDocs(node);
  if (!jsDocs) return [];

  return jsDocs.reduce((tagsAcc, jsDoc) => {
    tagsAcc.push(...jsDoc.getTags());
    return tagsAcc;
  }, [] as JSDocTag[]);
}

/**
 * TODO. This feature is not implemented yet. It will be used to create links for comments
 * that use {@link AnotherAPIItemInThisPlugin}.
 *
 * @param text
 */
function getTextWithLinks(text?: string): TextWithLinks {
  if (text) return [text];
  else return [];
  // TODO:
  // Replace `@links` in comments with relative api links.
}
