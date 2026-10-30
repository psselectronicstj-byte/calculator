# Offline Math PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Russian-first, installable offline math PWA for iPhone with the complete agreed calculator, algebra, equation, calculus, graphing, matrix, explanation, and history feature set.

**Architecture:** Build a React/TypeScript/Vite single-page app with feature modules behind app-owned math interfaces. Bundle and locally adapt compatible math packages; keep user inputs and history on-device, pre-cache the production app shell, and use Canvas 2D plus Three.js WebGL for plots. Implement each feature as a tested vertical slice, then verify the integrated release in Windows browsers and jointly on a real iPhone.

**Tech Stack:** TypeScript, React, Vite, Vitest, Playwright, IndexedDB, local symbolic/numerical math libraries selected by a compatibility spike, Canvas 2D, Three.js, and `vite-plugin-pwa` (subject to the compatibility/license spike).

**Spec:** [../specs/2026-10-30-offline-math-pwa-design.md](../specs/2026-10-30-offline-math-pwa-design.md)

## Global Constraints

- The source deliverable is a responsive PWA built with TypeScript, React, and Vite; it is not a native SwiftUI app or an App Store package.
- The minimum supported iPhone platform is iOS 17 with its bundled Safari.
- GitHub Pages is the selected static HTTPS hosting target.
- The service worker caches the app shell and production JS/CSS/assets, including mathematical libraries.
- Calculation/history data stays in browser storage (IndexedDB). No user data is sent to a service.
- 3D drawing uses browser WebGL. If WebGL is unavailable or context creation fails, show a clear explanation and keep the rest of the app usable.
- The user has access to an iPhone and will perform final iOS 17+ Safari acceptance together with the developer after deployment.
- The first public release includes the full scope in the spec; milestones are implementation and review gates, not separate public versions.
- Never evaluate user text with `eval`, `new Function`, or equivalent dynamic code generation.
- Never fabricate derivation steps; unsupported results and approximate results must be identified explicitly.
- Publish only once a user-owned GitHub repository and access are available.

## Review Focus

- Malformed or adversarial expression text must fail as input and must never execute as code; pin this in Task 2 parser/evaluator tests.
- Division by zero, invalid function domains, and non-finite intermediate or final values must produce explicit errors rather than success-shaped results; pin this in Task 2 and Task 4 tests.
- Numerical root search can miss roots outside its interval or between sampled points; return only residual-checked roots in the requested interval and state the finite-search limitation; pin this in Task 3 tests.
- Singular, non-square, or incompatible matrices must report the specific unsupported/shape/singularity outcome rather than a misleading numeric answer; pin this in Task 7 tests.
- Excessive plot ranges, sampling resolution, or matrix dimensions must be rejected with a clear resource-limit message, not silently clamped or allowed to freeze the interface; pin this in Tasks 5-7.

---

### Task 1: Creating the local PWA foundation and verifying math dependencies

**Files:**
- Create: `package.json`, `package-lock.json`, `index.html`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`
- Create: `src/main.tsx`, `src/App.tsx`, `src/styles/tokens.css`, `src/styles/global.css`
- Create: `src/math/engine-spike.test.ts`, `src/test/setup.ts`
- Create: `public/favicon.svg`, `public/icons/app-192.png`, `public/icons/app-512.png`
- Create: `LICENSES.md`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `preview`, `typecheck`, `test`, and `test:e2e`.
- Produces: a runnable React/Vite shell and the pinned dependency set used by later tasks.

- [ ] **Step 1: Create the test harness and candidate dependency probes**

Create the minimal package manifest and test scripts; install provisional candidates from the spec and the test runner. Create `src/math/engine-spike.test.ts` to exercise, at minimum: scalar parsing/evaluation, implicit multiplication in the supported expression grammar, simplify/expand/factor/solve-for-variable, exact linear/quadratic solving, symbolic derivative and common antiderivative, definite numerical integration, determinant/inverse/rank/eigenvalues, and package behavior under Vite production bundling. Record expected and unsupported input classes explicitly.

- [ ] **Step 2: Run the dependency probes**

Run: `npm test -- --run src/math/engine-spike.test.ts`
Expected: every probe executes; test results identify the actual supported/unsupported cases and bundling failures without missing-package or test-runner errors.

- [ ] **Step 3: Scaffold the application and select compatible packages**

Create the minimal React/Vite shell and scripts. Evaluate the spec's library candidates and any required PWA/test packages against the spike cases, Vite compatibility, offline bundling, package size, and complete transitive licenses. Select and pin exact compatible versions in `package.json`; document unsupported cases and licenses in `LICENSES.md`. Do not add a package that is not needed by a tested requirement.

- [ ] **Step 4: Run the spike and baseline checks**

Run: `npm test -- --run src/math/engine-spike.test.ts`
Expected: PASS for documented supported cases, with explicit assertions for unsupported cases.

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run build`
Expected: PASS with all math libraries bundled locally and no remote runtime scripts.

- [ ] **Step 5: Commit the foundation**

```text
feat: scaffold offline math PWA
```

### Task 2: Building the shared math contract, scientific calculator, editor, and local history

**Files:**
- Create: `src/domain/math-outcome.ts`, `src/domain/feature.ts`, `src/domain/history-entry.ts`
- Create: `src/math/expression/normalize.ts`, `src/math/expression/parse.ts`, `src/math/evaluate.ts`
- Create: `src/features/calculator/calculator-service.ts`, `src/features/calculator/CalculatorView.tsx`
- Create: `src/components/MathEditor.tsx`, `src/components/Keypad.tsx`, `src/components/ResultView.tsx`
- Create: `src/storage/history-store.ts`, `src/features/history/HistoryView.tsx`
- Create: `src/app/navigation.ts`, `src/app/AppShell.tsx`, `src/app/feature-registry.ts`
- Create: `src/features/calculator/calculator-service.test.ts`, `src/math/expression/normalize.test.ts`
- Create: `src/storage/history-store.test.ts`, `src/features/history/HistoryView.test.tsx`
- Modify: `src/App.tsx`, `src/styles/global.css`

**Interfaces:**
- Produces `CalculationStep = { title: string; expression?: string; explanation: string }`.
- Produces `MathOutcome<T> = { ok: true; status: "exact" | "approximate"; value: T; steps: CalculationStep[]; notes: string[] } | { ok: false; code: "invalid-input" | "invalid-range" | "invalid-shape" | "domain-error" | "unsupported" | "no-solution" | "inconsistent" | "underdetermined" | "singular" | "resource-limit"; message: string }`.
- Produces `FeatureKind = "calculator" | "algebra" | "equations" | "calculus" | "graph2d" | "graph3d" | "matrices"`.
- Produces `evaluateScientific(input: string, angleMode: "radians" | "degrees"): MathOutcome<number>`.
- Produces `normalizeExpression(input: string): MathOutcome<string>`; inserts only grammar-supported implicit multiplication and rejects malformed tokens.
- Produces `HistoryEntry = { id: string; feature: FeatureKind; input: string; result: string; status: "exact" | "approximate" | "unsupported"; createdAt: number }`.
- Produces `historyStore.list(): Promise<HistoryEntry[]>`, `historyStore.add(entry): Promise<void>`, `historyStore.delete(id): Promise<void>`, and `historyStore.clear(): Promise<void>`.

- [ ] **Step 1: Write failing tests for expression normalization and scientific evaluation**

Test precedence and parentheses; `2(3+4)`, `2pi`, `2x`, and supported `2sin(pi/2)` normalization; radians/degrees; `pi`, `e`, powers, `sin`, `cos`, `tan`, `sqrt`, `abs`, `log`, and `ln`; malformed tokens; disallowed identifiers/functions; division by zero; invalid domains; and non-finite results. Assert no unsupported expression is returned as a successful number.

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `npm test -- --run src/math/expression/normalize.test.ts src/features/calculator/calculator-service.test.ts`
Expected: FAIL because normalization and calculator service are not implemented.

- [ ] **Step 3: Implement the shared outcome contract and parser/evaluator**

Implement `normalizeExpression(input: string): MathOutcome<string>` and `evaluateScientific(input: string, angleMode: "radians" | "degrees"): MathOutcome<number>` using the pinned parser APIs, not JavaScript code generation. Accept only the documented calculator functions/constants; validate results are finite before returning success. Include only derivation steps that the app can justify; otherwise return an empty trace without implying a proof.

- [ ] **Step 4: Run the targeted math tests**

Run: `npm test -- --run src/math/expression/normalize.test.ts src/features/calculator/calculator-service.test.ts`
Expected: PASS, including malformed/adversarial text and domain-error controls.

- [ ] **Step 5: Write failing IndexedDB and history UI tests**

Test adding, listing, deleting one record, clearing records, persistence across store re-open, empty state, and re-opening a history row into its original feature/input. Use a fresh database name per test and clean it up after each case.

- [ ] **Step 6: Implement IndexedDB history and calculator UI**

Implement the declared `historyStore` methods; calculator UI; cursor-aware editor/keypad insertion; radians/degrees control; result status and supported-step display; feature navigation; Russian labels; and history actions. Keep calculations local. Validate all interactive controls with accessible names and keyboard focus.

- [ ] **Step 7: Verify feature tests, typecheck, and baseline browser flow**

Run: `npm test -- --run src/storage/history-store.test.ts src/features/history/HistoryView.test.tsx src/features/calculator/calculator-service.test.ts`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run test:e2e -- --project=chromium`
Expected: calculator evaluates a supported expression, an invalid expression shows a useful error, and history survives reload.

- [ ] **Step 8: Commit the calculator and storage slice**

```text
feat: add scientific calculator and local history
```

### Task 3: Adding algebra transformations and equation solving

**Files:**
- Create: `src/math/adapters/symbolic.ts`
- Create: `src/features/algebra/algebra-service.ts`, `src/features/algebra/AlgebraView.tsx`
- Create: `src/features/equations/equation-service.ts`, `src/features/equations/EquationView.tsx`
- Create: `src/math/adapters/symbolic.test.ts`
- Create: `src/features/algebra/algebra-service.test.ts`, `src/features/equations/equation-service.test.ts`
- Modify: `src/app/feature-registry.ts`, `src/domain/math-outcome.ts`

**Interfaces:**
- Consumes: `MathOutcome<T>`, `CalculationStep`, `normalizeExpression()`, and the pinned engine set from Tasks 1-2.
- Produces `transformExpression(input: string, operation: "simplify" | "expand" | "factor" | "solve-for", variable?: string): MathOutcome<string>`.
- Produces `solveEquation(input: string, variable: string, mode: "exact" | "decimal"): MathOutcome<string[]>`.
- Produces `solveRootsInInterval(equation: string, variable: string, min: number, max: number): MathOutcome<number[]>`.
- Produces `solveLinearSystem(coefficients: number[][], constants: number[]): MathOutcome<number[]>`.

- [ ] **Step 1: Write failing algebra tests**

Test simplify, expand, factor, and solve-for-variable on representative supported polynomial expressions. Include a cancellation/domain-restriction example and require a warning or unsupported result rather than an unqualified equivalence when the engine cannot preserve the original domain.

- [ ] **Step 2: Run algebra tests and verify failure**

Run: `npm test -- --run src/features/algebra/algebra-service.test.ts`
Expected: FAIL because the algebra adapter does not exist.

- [ ] **Step 3: Implement the symbolic adapter and algebra service**

Implement `transformExpression(...)` behind app-owned APIs. Normalize input through the shared parser; return engine results with exactness and only defensible steps; produce an explicit unsupported outcome when the pinned engine cannot support the requested operation.

- [ ] **Step 4: Run algebra tests**

Run: `npm test -- --run src/features/algebra/algebra-service.test.ts`
Expected: PASS for supported transformations and explicit handling of the domain-restriction control.

- [ ] **Step 5: Write failing equation tests**

Test `left = right` parsing; exact and decimal linear/quadratic solutions; repeated roots; no-real-solution cases; malformed equations; unique, inconsistent, and underdetermined linear systems; and interval root search with residual checks and interval bounds. Assert that interval-search results warn that finite search can miss roots.

- [ ] **Step 6: Implement equation services and screens**

Implement `solveEquation(...)`, `solveRootsInInterval(...)`, and `solveLinearSystem(...)`. Distinguish exact/decimal results, classify linear-system outcomes using `inconsistent` and `underdetermined` error codes, sample `1024` equal subintervals and refine sign-changing brackets for up to `100` iterations, accepting roots only when the residual is at most `1e-8`; document that finite sampling can miss roots. Reject invalid intervals with `invalid-range`. Add equation/algebra screens and save operations through the shared history store.

- [ ] **Step 7: Run algebra/equation checks**

Run: `npm test -- --run src/math/adapters/symbolic.test.ts src/features/algebra/algebra-service.test.ts src/features/equations/equation-service.test.ts`
Expected: PASS for all classifications and numerical validation cases.

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit the algebra and equation slice**

```text
feat: add symbolic algebra and equation solving
```

### Task 4: Adding symbolic and numerical calculus

**Files:**
- Create: `src/features/calculus/calculus-service.ts`, `src/features/calculus/CalculusView.tsx`
- Create: `src/math/adapters/calculus.ts`
- Create: `src/features/calculus/calculus-service.test.ts`
- Modify: `src/app/feature-registry.ts`

**Interfaces:**
- Consumes: shared expression normalization, `MathOutcome<T>`, symbolic adapter, and pinned libraries from Tasks 1-3.
- Produces `differentiate(input: string, variable: string): MathOutcome<string>`.
- Produces `antidifferentiate(input: string, variable: string): MathOutcome<string>`.
- Produces `integrateDefinite(input: string, variable: string, lower: number, upper: number): MathOutcome<number | string>`.

- [ ] **Step 1: Write failing calculus tests**

Test symbolic derivatives for supported polynomial, trigonometric, exponential, and logarithmic forms; common supported antiderivatives; definite symbolic evaluation when available; adaptive numerical fallback when symbolic evaluation is unsupported; reversed bounds; equal bounds; invalid domains; and unsupported antiderivatives. Assert numerical answers are marked approximate and include the method/tolerance notes.

- [ ] **Step 2: Run calculus tests and verify failure**

Run: `npm test -- --run src/features/calculus/calculus-service.test.ts`
Expected: FAIL because calculus adapters are not implemented.

- [ ] **Step 3: Implement calculus adapters and UI**

Implement the three declared functions using the verified dependency behavior. Use adaptive Simpson integration with absolute error tolerance `1e-8` and maximum recursion depth `20`; report exact vs approximate status correctly. Add rule/substitution steps only when they are actually supplied or reconstructed by a verified supported rule; otherwise return the result without fabricated steps. Save calculus operations through the shared history store.

- [ ] **Step 4: Run calculus and error-control tests**

Run: `npm test -- --run src/features/calculus/calculus-service.test.ts`
Expected: PASS for supported symbolic cases, numerical fallback tolerance, and unsupported/domain controls.

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit the calculus slice**

```text
feat: add symbolic and numerical calculus
```

### Task 5: Adding bounded 2D graphing

**Files:**
- Create: `src/features/graphs/graph-types.ts`, `src/features/graphs/sampler.ts`
- Create: `src/features/graphs/Graph2DView.tsx`, `src/features/graphs/GraphInputList.tsx`
- Create: `src/features/graphs/sampler.test.ts`, `src/features/graphs/Graph2DView.test.tsx`
- Modify: `src/app/feature-registry.ts`, `src/styles/global.css`

**Interfaces:**
- Produces `GraphExpression = { id: string; expression: string; color: string }`.
- Produces `GraphRange = { xMin: number; xMax: number; yMin: number; yMax: number }`.
- Produces `sample2D(expression: string, range: GraphRange, width: number): MathOutcome<Array<{ x: number; y: number } | null>>`.

- [ ] **Step 1: Write failing graph sampler tests**

Test linear and curved graphs, multiple expressions on one screen, discontinuities, invalid domains, NaN/infinite samples, zero-width or reversed ranges, and the maximum of `2000` samples per expression. Assert invalid points become `null` path breaks and excessive requests return `resource-limit` rather than silently clamping.

- [ ] **Step 2: Run sampler tests and verify failure**

Run: `npm test -- --run src/features/graphs/sampler.test.ts`
Expected: FAIL because the sampler does not exist.

- [ ] **Step 3: Implement the sampler and Canvas 2D screen**

Implement `sample2D(...)` using the shared expression parser/evaluator. Limit samples to `2000` per expression and reject larger requests with `resource-limit`. Render labeled axes/grid and separate paths at `null` samples. Support multiple simultaneous expressions, pan/zoom, add/remove expressions, accessible controls, and visible unsupported/domain errors. Save graph expressions/ranges through the shared history store.

- [ ] **Step 4: Verify sampler and graph interactions**

Run: `npm test -- --run src/features/graphs/sampler.test.ts src/features/graphs/Graph2DView.test.tsx`
Expected: PASS, including graph breaks and resource limits.

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit the 2D graph slice**

```text
feat: add interactive 2D graphing
```

### Task 6: Adding bounded 3D surface graphing

**Files:**
- Create: `src/features/graphs/sampler3d.ts`, `src/features/graphs/Graph3DView.tsx`
- Create: `src/features/graphs/sampler3d.test.ts`, `src/features/graphs/Graph3DView.test.tsx`
- Modify: `src/features/graphs/graph-types.ts`, `src/app/feature-registry.ts`

**Interfaces:**
- Produces `Graph3DRange = { xMin: number; xMax: number; yMin: number; yMax: number; resolution: number }`.
- Produces `sample3D(expression: string, range: Graph3DRange): MathOutcome<Array<Array<{ x: number; y: number; z: number } | null>>>`.

- [ ] **Step 1: Write failing 3D sampling and renderer tests**

Test `z=x+y` samples, multiple simultaneous surfaces, invalid-domain holes, all-invalid surfaces, invalid/reversed ranges, the default resolution of `64`, the maximum resolution of `128`, a request above `128`, unsupported WebGL, and WebGL context loss. Assert no excessive resolution is silently clamped and all other app sections remain usable if rendering is unavailable.

- [ ] **Step 2: Run 3D tests and verify failure**

Run: `npm test -- --run src/features/graphs/sampler3d.test.ts src/features/graphs/Graph3DView.test.tsx`
Expected: FAIL because surface sampling and rendering are not implemented.

- [ ] **Step 3: Implement surface sampling and Three.js renderer**

Implement `sample3D(...)` with default resolution `64`, maximum resolution `128`, finite ranges, and `null` breaks for invalid samples. Reject requests above the maximum with `resource-limit`. Render one or more `z=f(x,y)` surfaces with rotate/pan/zoom, axes, cleanup of WebGL resources, and a clear fallback message when WebGL is unavailable or lost. Save graph expressions/ranges through the shared history store.

- [ ] **Step 4: Verify 3D behavior and production bundling**

Run: `npm test -- --run src/features/graphs/sampler3d.test.ts src/features/graphs/Graph3DView.test.tsx`
Expected: PASS for valid, invalid, limit, and WebGL fallback cases.

Run: `npm run build`
Expected: PASS with the renderer bundled locally and lazily loaded if needed to keep initial load practical.

- [ ] **Step 5: Commit the 3D graph slice**

```text
feat: add interactive 3D surface plots
```

### Task 7: Adding matrix operations and classifications

**Files:**
- Create: `src/features/matrices/matrix-types.ts`, `src/features/matrices/matrix-service.ts`
- Create: `src/features/matrices/MatrixEditor.tsx`, `src/features/matrices/MatricesView.tsx`
- Create: `src/features/matrices/matrix-service.test.ts`, `src/features/matrices/MatrixEditor.test.tsx`
- Modify: `src/app/feature-registry.ts`

**Interfaces:**
- Produces `Matrix = number[][]`.
- Consumes: `solveLinearSystem(coefficients: number[][], constants: number[]): MathOutcome<number[]>` from Task 3.
- Produces `EigenResult = { values: number[]; vectors: Matrix }`.
- Produces `matrixOperation(operation: "add" | "multiply" | "transpose" | "determinant" | "inverse" | "rank" | "eigen", left: Matrix, right?: Matrix): MathOutcome<number | number[] | Matrix | EigenResult>`.
- Produces `solveMatrixSystem(coefficients: Matrix, constants: number[]): MathOutcome<number[]>`.

- [ ] **Step 1: Write failing matrix tests**

Test addition, multiplication, transpose, determinant, inverse, solving `Ax=b`, rank, eigenvalues/eigenvectors for supported real matrices, incompatible dimensions, empty/ragged/non-numeric input, non-square determinant/inverse/eigen requests, singular inverse, inconsistent/underdetermined systems, complex eigenvalue boundary, basic-operation dimensions above `20 x 20`, and eigenproblems above `10 x 10`.

- [ ] **Step 2: Run matrix tests and verify failure**

Run: `npm test -- --run src/features/matrices/matrix-service.test.ts`
Expected: FAIL because matrix services are not implemented.

- [ ] **Step 3: Implement matrix services and editor**

Implement the declared operations using the spike-verified library APIs. Validate rectangular shape, dimensions, finite entries, and real-valued support before calculation. Limit basic operations to `20 x 20` and eigenproblems to `10 x 10`; reject larger inputs with `resource-limit`. Reuse `solveLinearSystem(...)` for `solveMatrixSystem(...)`. Return explicit singular/unsupported outcomes; do not convert library failures into plausible numeric answers. Save matrix operations through the shared history store.

- [ ] **Step 4: Verify operations and classifications**

Run: `npm test -- --run src/features/matrices/matrix-service.test.ts src/features/matrices/MatrixEditor.test.tsx`
Expected: PASS for supported operations and every invalid/singular/unsupported control.

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit the matrix slice**

```text
feat: add matrix operations and solving
```

### Task 8: Completing PWA lifecycle, accessibility, and integrated end-to-end coverage

**Files:**
- Create: `public/manifest.webmanifest`, `src/pwa/register-service-worker.ts`
- Create: `tests/e2e/app.spec.ts`, `tests/e2e/offline.spec.ts`, `tests/e2e/features.spec.ts`
- Create: `docs/deployment.md`, `docs/iphone-acceptance.md`
- Modify: `vite.config.ts`, `playwright.config.ts`, `src/app/AppShell.tsx`, `src/styles/global.css`, `package.json`

**Interfaces:**
- Produces a manifest with standalone display mode, app name, theme/background colors, and 192/512 icons.
- Produces a cache-first app-shell policy for versioned local production assets, with an explicit update path and no remote runtime dependency.
- Produces reproducible browser acceptance commands and a manual iOS 17+ Safari checklist.

- [ ] **Step 1: Write failing integrated Playwright scenarios**

Cover responsive navigation for every feature; calculator and history; algebra transformation and equation solution; derivative and definite integral; 2D graph path breaks; multiple 3D surfaces and WebGL fallback; matrix operation and validation; error states; history entries and reopen behavior for every feature; history deletion/clear; reload persistence; keyboard focus; and reduced-motion preference.

- [ ] **Step 2: Run the browser suite to confirm missing flows**

Run: `npm run test:e2e -- --project=chromium`
Expected: FAIL for unimplemented PWA lifecycle/feature workflows.

- [ ] **Step 3: Implement manifest, service-worker lifecycle, and accessible integration**

Configure install metadata, local precache of app entry points and all lazy-loaded math/rendering chunks, service-worker registration/update behavior, and base-path-safe asset URLs for GitHub Pages. Register the service worker through `src/pwa/register-service-worker.ts`. Verify first online visit installs the cache and subsequent offline reload serves the app and bundled features. Add Russian install/update/offline copy, keyboard focus, accessible labels, reduced-motion handling, and responsive layouts.

- [ ] **Step 4: Verify integrated workflows, offline lifecycle, and production**

Run: `npm test -- --run`
Expected: PASS for all unit/component tests.

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run test:e2e -- --project=chromium`
Expected: PASS for feature flows, reload/history, service-worker activation, and offline operation after successful precache.

Run: `npm run build`
Expected: PASS; audit generated assets to confirm no remote scripts/API dependencies and all shipped dependencies are covered by `LICENSES.md`.

- [ ] **Step 5: Commit the integrated PWA**

```text
feat: complete offline PWA lifecycle and accessibility
```

### Task 9: Preparing GitHub Pages deployment and completing iPhone acceptance

**Files:**
- Create: `.github/workflows/pages.yml`
- Modify: `vite.config.ts`, `docs/deployment.md`, `docs/iphone-acceptance.md`

**Interfaces:**
- Produces a GitHub Actions workflow that builds the static site and publishes it to GitHub Pages only for the configured user-owned repository.
- Produces a deployment checklist that does not require secrets for static hosting and does not publish to an unapproved repository.

- [ ] **Step 1: Verify deployment build under a project-page base path**

Run: `npm run build -- --base=/Mathlab-iPhone/`
Expected: PASS; generated links to manifest, icons, scripts, styles, and service worker use the configured base path.

- [ ] **Step 2: Implement GitHub Pages workflow and instructions**

Add a least-privilege Pages workflow with read access to repository contents and write access to Pages/deployment only as required. Keep repository name/base path configurable. Document how the owner enables Pages and supplies repository access; do not add credentials or publish without authorization.

- [ ] **Step 3: Verify final automated acceptance gates**

Run: `npm test -- --run`
Expected: PASS.

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run test:e2e -- --project=chromium`
Expected: PASS.

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Complete joint iPhone acceptance after authorized HTTPS deployment**

Using Safari on iOS 17 or later, verify Add to Home Screen, standalone launch, first online caching, airplane-mode calculations and saved history, 2D pan/zoom, 3D rotate/zoom, WebGL fallback if available, readable controls, and no data loss on reload. Record pass/fail and device/browser version in `docs/iphone-acceptance.md`; fix failures before calling the first public release complete.

- [ ] **Step 5: Commit deployment readiness**

```text
chore: prepare GitHub Pages release
```
