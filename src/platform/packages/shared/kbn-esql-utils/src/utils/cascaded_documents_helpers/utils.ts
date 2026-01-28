/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { getDataViewFieldSubtypeMulti } from '@kbn/es-query';
import { type DataView } from '@kbn/data-views-plugin/public';
import type { ESQLFunction, EsqlQuery } from '@kbn/esql-language';
import {
  Builder,
  isFunctionExpression,
  mutate,
  type ESQLCommand,
  type ESQLLiteral,
} from '@kbn/esql-language';
import type { StatsFieldSummary } from '@kbn/esql-language/src/ast/mutate/commands/stats';
import type { ESQLControlVariable } from '@kbn/esql-types';
import { getQuerySummaryPerCommandType } from '../get_query_summary';
import { PARAM_TYPES_NO_NEED_IMPLICIT_STRING_CASTING } from '../append_to_query/utils';

// list of stats functions we support for grouping in the cascade experience
export const SUPPORTED_STATS_COMMAND_OPTION_FUNCTIONS = ['categorize' as const];

export type SupportedStatsFunction = (typeof SUPPORTED_STATS_COMMAND_OPTION_FUNCTIONS)[number];

export const isSupportedStatsFunction = (fnName: string): fnName is SupportedStatsFunction =>
  SUPPORTED_STATS_COMMAND_OPTION_FUNCTIONS.includes(fnName as SupportedStatsFunction);

export type SupportedFieldTypes = Exclude<
  keyof typeof Builder.expression.literal,
  'nil' | 'numeric' | 'timespan'
>;

export type FieldValue<T extends SupportedFieldTypes> =
  | Parameters<(typeof Builder.expression.literal)[T]>[0]
  | unknown;

export const isCategorizeFunctionWithFunctionArgument = (functionDefinition: ESQLFunction) => {
  return (
    functionDefinition.name === 'categorize' &&
    functionDefinition.args.length === 1 &&
    isFunctionExpression(functionDefinition.args[0])
  );
};

// helper for removing backticks from field names of function names
export const removeBackticks = (str: string) => str.replace(/`/g, '');

/**
 * constrains the field value type to be one of the supported field value types, else we process as a string literal when building the expression
 */
export const isSupportedFieldType = (fieldType: unknown): fieldType is SupportedFieldTypes => {
  return (
    PARAM_TYPES_NO_NEED_IMPLICIT_STRING_CASTING.includes(fieldType as SupportedFieldTypes) &&
    Object.keys(Builder.expression.literal).includes(fieldType as SupportedFieldTypes)
  );
};

/**
 * if value is a text or keyword field and it's not "aggregatable", we opt to use match phrase for the where command
 */
export const requiresMatchPhrase = (fieldName: string, dataViewFields: DataView['fields']) => {
  let dataViewField = dataViewFields.getByName(fieldName);

  const multiSubtype = dataViewField && getDataViewFieldSubtypeMulti(dataViewField);

  if (multiSubtype) {
    // if the field is a subtype, we want to use the parent field to determine wether to use the match phrase
    dataViewField = dataViewFields.getByName(multiSubtype.multi.parent);
  }

  return (
    !dataViewField?.aggregatable &&
    (dataViewField?.esTypes?.includes('text') || dataViewField?.esTypes?.includes('keyword'))
  );
};

/**
 * Returns the stats command to operate on, we operate on the last stats command in the query
 */
export function getStatsCommandToOperateOn(esqlQuery: EsqlQuery) {
  if (esqlQuery.errors.length) {
    return null;
  }

  const statsCommands = Array.from(mutate.commands.stats.list(esqlQuery.ast));

  if (statsCommands.length === 0) {
    return null;
  }

  // accounting for the possibility of multiple stats commands in the query,
  // we always want to operate on the last stats command
  const lastStatsCommandIndex = statsCommands.length - 1;

  const summarizedStatsCommand = mutate.commands.stats.summarizeCommand(
    esqlQuery,
    statsCommands[lastStatsCommandIndex]
  );

  return Object.assign(summarizedStatsCommand, { index: lastStatsCommandIndex });
}

/**
 * Returns the data source command from the esql query, supports both the FROM and TS commands
 */
export function getESQLQueryDataSourceCommand(
  esqlQuery: EsqlQuery
): ESQLCommand<'from' | 'ts'> | undefined {
  return mutate.generic.commands.find(
    esqlQuery.ast,
    (cmd) => cmd.name === 'from' || cmd.name === 'ts'
  ) as ESQLCommand<'from' | 'ts'> | undefined;
}

/**
 * Returns runtime fields that are created within the query by the STATS command in the query
 */
export function getStatsCommandRuntimeFields(esqlQuery: EsqlQuery) {
  const querySummary = getQuerySummaryPerCommandType(esqlQuery.print(), 'stats');
  return querySummary.map((command) => command.newColumns);
}

/**
 * Returns the summary of the stats command at the given command index in the esql query
 */
export function getStatsCommandAtIndexSummary(esqlQuery: EsqlQuery, commandIndex: number) {
  const declarationCommand = mutate.commands.stats.byIndex(esqlQuery.ast, commandIndex);

  if (!declarationCommand) {
    return null;
  }

  return mutate.commands.stats.summarizeCommand(esqlQuery, declarationCommand);
}

/**
 * Returns the param definition for the given field name
 */
export function getFieldParamDefinition(
  fieldName: string,
  fieldTerminals: StatsFieldSummary['terminals'],
  esqlVariables: ESQLControlVariable[] | undefined
) {
  const fieldParamDef = fieldTerminals.find(
    (arg) => arg.text === fieldName && arg.type === 'literal' && arg.literalType === 'param'
  ) as ESQLLiteral | undefined;

  if (fieldParamDef) {
    const controlVariable = esqlVariables?.find((variable) => variable.key === fieldParamDef.value);

    if (!controlVariable) {
      throw new Error(`The control variable for the "${fieldName}" column was not found`);
    }

    return controlVariable.value;
  }
}

export function getStatsGroupFieldType<
  T extends StatsFieldSummary | undefined,
  R = T extends StatsFieldSummary ? string : undefined
>(groupByFields: T): R {
  if (!groupByFields) {
    return undefined as R;
  }

  return (
    groupByFields.definition.type === 'function'
      ? groupByFields.definition.name
      : groupByFields.definition.type
  ) as R;
}
