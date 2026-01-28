# Current Behavior Documentation

This document describes how `kbn-docs-utils` currently works, focusing on validation and stats collection.

## Overview

The `kbn-docs-utils` package builds API documentation from TypeScript source code using `ts-morph`. It can either:
1. Generate documentation (MDX files)
2. Collect validation stats (via `--stats` flag)
3. Both (default behavior without `--stats`)

## Main Flow

```
build_api_docs_cli.ts
  ↓
1. Initialize APM transaction
2. Parse CLI flags (--plugin, --stats, --references)
3. Find plugins via findPlugins()
4. Get paths by package via getPathsByPackage()
5. Create ts-morph Project via getTsProject()
6. Build plugin API map via getPluginApiMap()
   ↓
   getPluginApiMap()
     ↓
     For each plugin:
       - getPluginApi() → builds ApiDeclaration[] for client/server/common
       - removeBrokenLinks() → removes references to non-exported APIs
       - collectDeprecations() → tracks deprecated APIs
       - collectAdoptionTrackedAPIs() → tracks APIs with @track-adoption tag
     ↓
     Returns: pluginApiMap, missingApiItems, referencedDeprecations, 
              unreferencedDeprecations, adoptionTrackedAPIs
  ↓
7. Collect stats for each plugin via collectApiStatsForPlugin()
8. If --stats flag: output stats tables and exit
9. If not --stats: write documentation files
```

## Stats Collection: collectApiStatsForPlugin

**Location**: `src/stats.ts`

**Function**: `collectApiStatsForPlugin(pluginApi, missingApiItems, deprecations, adoptionTrackedAPIs)`

### What It Does

1. Initializes stats object with empty arrays and counts
2. Iterates through all API declarations in `client`, `server`, and `common` scopes
3. For each `ApiDeclaration`, calls `collectStatsForApi()` recursively
4. Aggregates deprecation and adoption tracking stats

### Validation Rules

The function checks for three main issues:

#### 1. Missing Comments
- **Check**: `doc.description === undefined || doc.description.length === 0`
- **Location**: `collectStatsForApi()` in `stats.ts:67`
- **Behavior**: 
  - Checks if `description` field is missing or empty
  - Recursively checks all children
  - Skips `node_modules` paths
  - **Issue**: Does not account for destructured parameters properly (see Known Gaps)

#### 2. Any Type Usage
- **Check**: `doc.type === TypeKind.AnyKind`
- **Location**: `collectStatsForApi()` in `stats.ts:75`
- **Behavior**: Flags any API declaration with `TypeKind.AnyKind`
- **Examples**: 
  - Generic defaults like `T = any`
  - Explicit `any` types
  - Index signatures `[key: string]: any`

#### 3. Missing Exports
- **Check**: `missingApiItems[pluginId]` object keys
- **Location**: `collectApiStatsForPlugin()` in `stats.ts:36`
- **Behavior**: Counts API items that are referenced but not exported from index files
- **Source**: Populated by `removeBrokenLinks()` in `get_plugin_api_map.ts`

### Stats Output Structure

```typescript
interface ApiStats {
  missingComments: ApiDeclaration[];      // APIs without descriptions
  isAnyType: ApiDeclaration[];            // APIs using `any` type
  noReferences: ApiDeclaration[];         // APIs with no references
  apiCount: number;                       // Total API count
  missingExports: number;                  // Count of missing exports
  deprecatedAPIsReferencedCount: number;  // Deprecated APIs still in use
  unreferencedDeprecatedApisCount: number;
  adoptionTrackedAPIs: AdoptionTrackedAPIStats[];
  adoptionTrackedAPIsCount: number;
  adoptionTrackedAPIsUnreferencedCount: number;
}
```

## Parameter Extraction: buildApiDecsForParameters

**Location**: `src/build_api_declarations/build_parameter_decs.ts`

**Function**: `buildApiDecsForParameters(params, parentOpts, jsDocs)`

### What It Does

1. Iterates through function parameters
2. For each parameter:
   - Creates an `ApiDeclaration` with parameter info
   - If parameter has a `TypeLiteral` type node, recursively builds children
   - Otherwise, creates a basic API declaration
   - Extracts JSDoc comment via `getJSDocParamComment(jsDocs, paramName)`

### Current JSDoc Parameter Handling

**Location**: `src/build_api_declarations/js_doc_utils.ts`

**Function**: `getJSDocParamComment(node, name)`

- Searches for `@param` tags matching the parameter name exactly
- Returns comment text if found, empty array otherwise
- **Limitation**: Only matches exact parameter names, does not handle property-level tags

### Destructured Parameter Handling

When a parameter is destructured (e.g., `{ fn1, fn2 }: { fn1: Function, fn2: Function }`):

1. The parameter is detected as having a `TypeLiteral` type node
2. `buildApiDeclaration()` is called on the type node, creating children
3. Each child property gets its own `ApiDeclaration`
4. **Issue**: JSDoc comments are only checked for the top-level parameter name
   - Example: `@param { fn1, fn2 }` would match the destructured parameter
   - But `@param { fn1, fn2 }.fn1` or `@param obj.prop` (per JSDoc spec) is NOT checked

## Known Gaps and Issues

### 1. Destructured Parameter JSDoc Validation

**Problem**: According to [JSDoc spec](https://jsdoc.app/tags-param#parameters-with-properties), destructured parameters should be documented using property notation:

```typescript
/**
 * @param obj A parameter object
 * @param obj.prop1 Description of prop1
 * @param obj.prop2 Description of prop2
 */
function example({ prop1, prop2 }: { prop1: string; prop2: number }) {}
```

**Current Behavior**:
- The system extracts child properties from destructured parameters
- But `getJSDocParamComment()` only checks for exact name matches
- Property-level comments (e.g., `obj.prop1`) are not validated
- This can lead to false positives for "missing comments" on destructured parameter children

**Example from fixtures**: `crazyFunction` in `fns.ts`:
- Has `@param obj` comment for the first parameter
- But nested properties (`hi`, `fn1`, `fn2`, etc.) don't have individual JSDoc tags
- These would be flagged as "missing comments" even though the parent has a comment

### 2. Missing Property-Level Validation

**Problem**: When a parameter is an object type, the system creates children for each property, but doesn't validate that each property has appropriate JSDoc.

**Current Behavior**:
- Properties are extracted as children
- Each child is checked for `description`, but the check doesn't account for:
  - Parent parameter having a comment (acceptable per some standards)
  - Property-level JSDoc tags (required per JSDoc spec for destructured params)

### 3. No Validation for @returns Tags

**Problem**: Functions can have missing `@returns` documentation, but this isn't currently validated.

**Current Behavior**:
- `returnComment` is extracted if present
- But there's no validation rule checking if functions should have `@returns` tags

### 4. Inconsistent JSDoc Detection

**Problem**: The system may not detect all forms of JSDoc comments consistently.

**Current Behavior**:
- `getJSDocParamComment()` uses exact string matching
- Doesn't handle variations or edge cases in JSDoc syntax

## Integration Test Fixtures

The integration tests use fixtures in `src/integration_tests/__fixtures__/src/plugin_a/` to test various scenarios:

- **fns.ts**: Functions with various JSDoc patterns, including `crazyFunction` with destructured params
- **classes.ts**: Classes, interfaces, generics, internal tags
- **types.ts**: Type aliases, unions, generics, enums
- **const_vars.ts**: Object exports, namespace-like objects, arrays
- **plugin.ts**: Plugin setup/start contracts

These fixtures demonstrate current behavior but may not all represent "correct" JSDoc according to standards.

## CLI Flags

### --plugin
- Filters to specific plugin(s)
- Can be a single string or array
- When combined with `--stats` and single plugin, skips doc generation for speed

### --stats
- Accepts: `any`, `comments`, `exports` (or combination)
- When present, only outputs stats tables, doesn't write docs
- Outputs console tables for each selected stat type

### --references
- Enables reference collection for API items
- Used to track which plugins use which APIs
- More expensive operation, typically only used for specific plugins

## Next Steps

See `FIXTURE_VALIDATION_MAP.md` for detailed mapping of fixture files to validation expectations and known issues.

