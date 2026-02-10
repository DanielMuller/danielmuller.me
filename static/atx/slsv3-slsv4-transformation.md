# Upgrade Serverless Framework v3 to v4 and Replace Webpack with ESBuild

## Objective
Upgrade Serverless Framework projects from version 3 to version 4 while migrating from webpack bundling to the built-in esbuild bundler, updating to Node.js 24 runtime for improved performance and simplified build configuration.

## Summary
This transformation upgrades the Serverless Framework configuration from v3 to v4, removes webpack dependencies and configuration, configures the built-in esbuild bundler, and updates the Node.js runtime to version 24. The process involves updating package dependencies, modifying serverless.yml configuration to use esbuild settings, removing webpack plugin references, and adjusting any webpack-specific configurations to work with esbuild's bundling approach.

## Entry Criteria
1. Project uses Serverless Framework version 3.x
2. Project uses serverless-webpack plugin for bundling
3. Project targets Node.js runtime (any version compatible with upgrade to Node.js 24)
4. serverless.yml configuration file exists in the project
5. package.json exists with serverless and serverless-webpack dependencies

## Implementation Steps

1. Update package.json dependencies:
   - Remove `serverless-webpack` plugin dependency
   - Remove `webpack` and related webpack dependencies (webpack-cli, webpack-node-externals, etc.)
   - Update `serverless` dependency to version 4.x (latest stable)
   - Remove any webpack loader dependencies unless they serve other purposes

2. Update serverless.yml configuration:
   - Update `provider.runtime` to `nodejs24.x`
   - Remove `plugins` section reference to `serverless-webpack`
   - Remove any `custom.webpack` configuration section
   - Add esbuild configuration under `provider` or function level:
     ```yaml
     provider:
       runtime: nodejs24.x
       esbuild:
         bundle: true
         minify: true
         sourcemap: true
         exclude: ['aws-sdk']
         target: 'node24'
         platform: 'node'
     ```

3. Remove webpack configuration files:
   - Delete `webpack.config.js` or `webpack.config.ts` if present
   - Remove any custom webpack configuration files

4. Update handler paths if webpack changed them:
   - Verify function handler paths in serverless.yml match actual file structure
   - Esbuild uses the actual file paths, so ensure handler references are correct (e.g., `handler: src/functions/myFunction.handler`)

5. Update externals configuration:
   - Review any external dependencies that were excluded in webpack configuration
   - Add them to esbuild's `exclude` array in serverless.yml if needed
   - Note: `aws-sdk` and `@aws-sdk/*` packages should typically be excluded as they're available in Lambda runtime

6. Adjust for esbuild behavior differences:
   - Esbuild doesn't support dynamic requires - refactor any `require()` with dynamic paths to use static imports
   - Review usage of `__dirname` and `__filename` as esbuild may handle them differently
   - Update any code that relied on webpack-specific features like loaders or plugins

7. Update TypeScript configuration if applicable:
   - Ensure `tsconfig.json` has `"module": "ESNext"` or `"CommonJS"` for compatibility
   - Set `"target"` to `"ES2024"` or later for Node.js 24 compatibility

8. Run dependency installation:
   - Execute `npm install` or `yarn install` to update all dependencies
   - Resolve any peer dependency warnings

9. Update deployment scripts:
   - Remove any webpack-related build scripts from package.json
   - Update CI/CD pipelines that reference webpack or custom build steps
   - Serverless Framework v4 handles building automatically with esbuild

10. Test the build process:
    - Run `serverless package` to verify successful bundling with esbuild
    - Check the `.serverless` directory to confirm functions are bundled correctly
    - Verify bundle sizes are reasonable (esbuild typically produces smaller bundles)

## Validation / Exit Criteria

1. package.json no longer contains serverless-webpack or webpack dependencies
2. package.json shows serverless dependency at version 4.x or higher
3. serverless.yml specifies `runtime: nodejs24.x` for all functions
4. serverless.yml contains esbuild configuration and no webpack references
5. webpack.config.js and related webpack configuration files are removed
6. `serverless package` command completes successfully without errors
7. Generated bundle in .serverless directory contains expected functions
8. All Lambda functions deploy successfully to AWS
9. Deployed functions execute correctly in Node.js 24 runtime
10. Function cold start times and bundle sizes meet performance expectations
