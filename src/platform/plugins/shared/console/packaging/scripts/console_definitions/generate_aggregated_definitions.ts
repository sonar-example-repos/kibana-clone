/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

/* eslint-disable no-console */

import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';
import { merge } from 'lodash';
import globby = require('globby');
import { isRecord } from '../../../common/utils/record_utils';

type EndpointsAvailability = 'stack' | 'serverless';

interface Availability {
  stack?: boolean;
  serverless?: boolean;
}

interface EndpointDescription {
  availability?: Availability;
  patterns?: string[];
  url_params?: Record<string, unknown>;
  documentation?: string;
  [key: string]: unknown;
}

interface SpecDefinitionsJson {
  name: string;
  globals: Record<string, unknown>;
  endpoints: Record<string, unknown>;
}

type JsSpecLoader = (service: StandaloneSpecDefinitionsService) => void;

/**
 * Standalone version of SpecDefinitionsService for aggregation script
 */
export class StandaloneSpecDefinitionsService {
  name = 'es';
  globalRules: Record<string, unknown> = {};
  endpoints: Record<string, Record<string, unknown>> = {};
  hasLoadedDefinitions = false;

  versionPath: string;

  constructor(versionPath: string) {
    this.versionPath = versionPath;
  }

  addGlobalAutocompleteRules(parentNode: string, rules: unknown) {
    this.globalRules[parentNode] = rules;
  }

  addEndpointDescription(
    endpoint: string,
    description: EndpointDescription = {},
    docsLinkToApiReference: boolean = false
  ) {
    const copiedDescription: Record<string, unknown> = this.endpoints[endpoint]
      ? { ...this.endpoints[endpoint] }
      : {};

    let urlParamsDef: Record<string, unknown> | undefined;
    if (Array.isArray(description.patterns)) {
      description.patterns.forEach((p) => {
        // Defensive guard: `patterns` values come from generated JSON + overrides/manual JSON + legacy
        // JS loader modules. The runtime input isn't type-checked, so avoid calling `.includes()` on
        // non-strings (which would crash this build script).
        if (typeof p === 'string' && p.includes('{index}')) {
          urlParamsDef = urlParamsDef || {};
          urlParamsDef.ignore_unavailable = '__flag__';
          urlParamsDef.allow_no_indices = '__flag__';
          urlParamsDef.expand_wildcards = ['open', 'closed'];
        }
      });
    }

    if (urlParamsDef) {
      const existingUrlParams = isRecord(copiedDescription.url_params)
        ? copiedDescription.url_params
        : {};
      const mergedUrlParams = {
        ...(isRecord(description.url_params) ? description.url_params : {}),
        ...existingUrlParams,
        ...urlParamsDef,
      };
      description.url_params = mergedUrlParams;
    }

    if (docsLinkToApiReference) {
      description.documentation = 'https://www.elastic.co/docs/api';
    }

    Object.assign(copiedDescription, description);
    Object.assign(copiedDescription, {
      id: endpoint,
      patterns: [endpoint],
      methods: ['GET'],
      ...copiedDescription,
    });

    this.endpoints[endpoint] = copiedDescription;
  }

  asJson(): SpecDefinitionsJson {
    return {
      name: this.name,
      globals: this.globalRules,
      endpoints: this.endpoints,
    };
  }

  loadDefinitions(endpointsAvailability: EndpointsAvailability = 'stack') {
    if (!this.hasLoadedDefinitions) {
      this.loadJsonDefinitions(endpointsAvailability);
      this.loadJSDefinitions();
      this.hasLoadedDefinitions = true;
    }
    return this.asJson();
  }

  loadJsonDefinitions(endpointsAvailability: EndpointsAvailability) {
    const result = this.loadJSONDefinitionsFiles();

    Object.entries(result).forEach(([endpoint, raw]) => {
      if (!isRecord(raw)) return;

      const description = raw as EndpointDescription;
      const availability = description.availability;

      const addEndpoint =
        // If the 'availability' property doesn't exist, display the endpoint by default
        !availability ||
        (endpointsAvailability === 'stack' && Boolean(availability.stack)) ||
        (endpointsAvailability === 'serverless' && Boolean(availability.serverless));

      if (addEndpoint) {
        this.addEndpointDescription(endpoint, description, endpointsAvailability === 'serverless');
      }
    });
  }

  loadJSONDefinitionsFiles(): Record<string, unknown> {
    const jsonPath = path.join(this.versionPath, 'json');
    const generatedPath = path.join(jsonPath, 'generated');
    const overridesPath = path.join(jsonPath, 'overrides');
    const manualPath = path.join(jsonPath, 'manual');

    const generatedFiles = globby.sync(path.join(generatedPath, '*.json'));
    const overrideFiles = globby.sync(path.join(overridesPath, '*.json'));
    const manualFiles = globby.sync(path.join(manualPath, '*.json'));

    const jsonDefinitions: Record<string, unknown> = {};

    // Load generated files with overrides
    generatedFiles.forEach((file) => {
      const overrideFile = overrideFiles.find((f) => path.basename(f) === path.basename(file));
      const loadedRaw: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!isRecord(loadedRaw)) return;
      const loadedDefinition: Record<string, unknown> = loadedRaw;

      if (overrideFile) {
        const overrideRaw: unknown = JSON.parse(fs.readFileSync(overrideFile, 'utf8'));
        if (isRecord(overrideRaw)) {
          merge(loadedDefinition, overrideRaw);
        }
      }

      this.addToJsonDefinitions({ loadedDefinition, jsonDefinitions });
    });

    // Load manual files
    manualFiles.forEach((file) => {
      const loadedRaw: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!isRecord(loadedRaw)) return;
      const loadedDefinition: Record<string, unknown> = loadedRaw;
      this.addToJsonDefinitions({ loadedDefinition, jsonDefinitions });
    });

    return jsonDefinitions;
  }

  addToJsonDefinitions({
    loadedDefinition,
    jsonDefinitions,
  }: {
    loadedDefinition: Record<string, unknown>;
    jsonDefinitions: Record<string, unknown>;
  }) {
    Object.entries(loadedDefinition).forEach(([endpointName, endpointDescription]) => {
      if (jsonDefinitions[endpointName]) {
        // Add timestamp to create a unique key
        jsonDefinitions[`${endpointName}${Date.now()}`] = endpointDescription;
      } else {
        jsonDefinitions[endpointName] = endpointDescription;
      }
    });

    return jsonDefinitions;
  }

  loadJSDefinitions() {
    const jsIndexPath = path.join(this.versionPath, 'js', 'index.ts');

    if (!fs.existsSync(jsIndexPath)) {
      console.log(`No JS definitions found at: ${jsIndexPath}`);
      return;
    }

    try {
      // Dynamic require is necessary here because the path is determined at runtime based on version directories

      const localRequire = createRequire(__filename);
      const loaded: unknown = localRequire(jsIndexPath);

      const jsSpecLoaders = isRecord(loaded) ? loaded.jsSpecLoaders : undefined;
      if (!isJsSpecLoaders(jsSpecLoaders)) {
        console.log(`Invalid jsSpecLoaders export in: ${jsIndexPath}`);
        return;
      }

      jsSpecLoaders.forEach((loader) => loader(this));

      console.log(`✓ Loaded ${jsSpecLoaders.length} JS definition loaders`);
    } catch (error: unknown) {
      console.error(`Error loading JS definitions from ${jsIndexPath}:`, getErrorMessage(error));
      console.error('Stack:', getErrorStack(error));
    }
  }
}

/**
 * Main aggregation function
 */
export async function generateAggregatedDefinitions() {
  console.log('=== Console API Definitions Aggregator ===');

  const scriptDir = __dirname;
  console.log('Script directory:', scriptDir);

  const consoleDefinitionsDir = path.join(scriptDir, '..', '..', 'console_definitions_target');

  if (!fs.existsSync(consoleDefinitionsDir)) {
    console.error('Console definitions directory not found:', consoleDefinitionsDir);
    console.error('Run generate_console_definitions.sh first to generate version folders');
    process.exit(1);
  }

  const versionDirs = fs
    .readdirSync(consoleDefinitionsDir)
    .filter((item) => {
      const fullPath = path.join(consoleDefinitionsDir, item);
      return fs.statSync(fullPath).isDirectory() && !item.startsWith('.');
    })
    .sort();

  console.log('Found versions:', versionDirs);

  const aggregatedResponse: Record<string, { es: SpecDefinitionsJson }> = {};

  versionDirs.forEach((version) => {
    const versionPath = path.join(consoleDefinitionsDir, version);
    console.log(`Processing version: ${version}`);

    try {
      const service = new StandaloneSpecDefinitionsService(versionPath);
      const versionDefinitions = service.loadDefinitions('stack');

      aggregatedResponse[version] = { es: versionDefinitions };

      console.log(
        `✓ Processed version ${version}: ${
          Object.keys(versionDefinitions.endpoints).length
        } endpoints`
      );
    } catch (error: unknown) {
      console.error(`✗ Error processing version ${version}:`, getErrorMessage(error));
    }
  });

  const outputDir = path.join(scriptDir, '..', '..', 'console_definitions_target');
  const generatedFiles: string[] = [];

  Object.entries(aggregatedResponse).forEach(([version, versionData]) => {
    const outputPath = path.join(outputDir, `${version}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(versionData, null, 2));
    generatedFiles.push(outputPath);
  });

  // Clean up version folders after successful aggregation
  console.log('Cleaning up version folders...');
  versionDirs.forEach((version) => {
    if (aggregatedResponse[version]) {
      const versionPath = path.join(consoleDefinitionsDir, version);
      try {
        fs.rmSync(versionPath, { recursive: true, force: true });
        console.log(`Removed version folder: ${version}/`);
      } catch (error: unknown) {
        console.warn(
          `Warning: Could not remove version folder ${version}:`,
          getErrorMessage(error)
        );
      }
    }
  });

  console.log('\n=== Generation Complete ===');
  console.log(`Generated ${generatedFiles.length} versioned definition files:`);

  const versions = Object.keys(aggregatedResponse);
  generatedFiles.forEach((filePath, index) => {
    const version = versions[index];
    const data = aggregatedResponse[version];
    const endpointCount = Object.keys(data.es.endpoints).length;
    const globalRuleCount = Object.keys(data.es.globals).length;
    console.log(
      `  - ${path.basename(filePath)}: ${endpointCount} endpoints, ${globalRuleCount} global rules`
    );
  });

  console.log('');
  console.log('Versioned definition files are now available at:');
  console.log(outputDir);
  console.log('Look for files like: 9.0.json, 9.1.json, etc.');
}

// Run the script if called directly
if (require.main === module) {
  generateAggregatedDefinitions().catch((e) => {
    console.error(getErrorMessage(e));
    process.exitCode = 1;
  });
}

function isJsSpecLoaders(value: unknown): value is JsSpecLoader[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'function');
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getErrorStack(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}
