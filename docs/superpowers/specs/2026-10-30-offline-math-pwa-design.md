# Offline Math PWA — Design

## Intent
Build an original Russian-first iPhone mathematics app, installable from Safari as a static offline-first PWA. The first public release should include the scientific calculator, expression transformations, equation solving, 2D and 3D graphs, symbolic and numerical calculus, matrix operations, explanatory steps where supportable, and local history. Build and verify it on Windows; publish it later to an HTTPS static host so iPhone users can install it.

## Goals
- Make entering and editing formulae comfortable on a phone, with a math-aware keypad/editor and support for common implicit multiplication such as `2x`.
- Keep all supported calculations and saved history on the user's device; after the first HTTPS visit and completed app-shell caching, primary features work offline.
- Deliver useful symbolic algebra and calculus for defined input classes, plus numerical equation/integration tools; clearly distinguish exact, approximate, unsupported, and unconfirmed results.
- Include interactive 2D graphs and 3D surfaces `z=f(x,y)`.
- Present real, verifiable steps for operations with supported derivations; never invent a derivation when an engine cannot provide one.
- Use a distinct visual identity: “mathematical instrument” — graphite/green surfaces, restrained mint results, compact controls, and a clear formula-first hierarchy.
- Include the complete agreed feature set in the first public release, while implementing and testing feature slices in sequence before considering that release ready.

## Non-goals
- Reproduce Mathlab's proprietary code, visual assets, branding, or every feature.
- Guarantee symbolic simplification, factorization, integration, or equation solving for every mathematically valid input.
- Claim that the product is objectively superior to every competitor.
- Accounts, cloud sync, a custom backend, network-based math APIs, or server-side calculation.
- Parametric 3D curves/surfaces, 3D solids, or a full proof assistant in the first public release.

## Constraints
- The source deliverable is a responsive PWA built with TypeScript, React, and Vite; it is not a native SwiftUI app or an App Store package.
- The minimum supported iPhone platform is iOS 17 with its bundled Safari. iPhone installation is through Safari's Add to Home Screen flow from an HTTPS origin. A local desktop preview or HTTP page alone does not establish installability on iPhone.
- GitHub Pages is the selected static HTTPS hosting target. Deployment requires a user-owned GitHub repository; repository creation, account access, and publication are not assumed until explicitly available.
- The service worker caches the app shell and production JS/CSS/assets, including mathematical libraries. Initial installation requires a successful online visit; subsequent offline support is bounded by the browser's storage lifecycle and user-cleared site data.
- Calculation/history data stays in browser storage (IndexedDB). No user data is sent to a service.
- 3D drawing uses browser WebGL. If WebGL is unavailable or context creation fails, show a clear explanation and keep the rest of the app usable.
- The Windows workspace is `C:\Users\SOHIB\Documents\Mathlab-iPhone`. It is not currently a Git repository; the approved target folder exists and contains project documentation only.
- Xcode and the iOS Simulator are not available in the current environment. Windows browser/mobile emulation tests are possible; the user has access to an iPhone and will perform final iOS 17+ Safari acceptance together with the developer after deployment.

## Approaches
1. **Curated local JavaScript engines with an application-owned adapter layer (chosen):** Bundle a symbolic CAS and numerical/matrix package in the PWA, write app-owned adapters, graph sampling/rendering, persistence, steps, and validation. This offers broader offline features sooner while allowing UI and calculation contracts to stay independent of package APIs. Costs are bundle size, compatibility tests, and vendor/license review.
2. **Implement a complete symbolic/numerical engine from scratch in TypeScript:** Maximum ownership and control, but much longer work and higher risk of incomplete algebra/calculus coverage.
3. **Use a hosted math API:** Rejected because it breaks the core offline requirement and would send expressions off device.

The user chose bundled local libraries and confirmed the full feature set belongs in the first public release. The registry and upstream documentation reviewed on 2026-10-30 describe current candidates: Nerdamer 2.0.0 (Apache-2.0) exposes algebra, calculus, solving, and matrix-structure APIs; Math.js 15.2.0 (Apache-2.0) exposes symbolic simplification/derivatives and numerical matrix functions such as determinant, inverse, and eigenvalues; Three.js 0.187.0 (MIT) is a 3D rendering library. These are candidates, not an assurance of complete feature coverage: pin compatible versions only after the spike, test each requested feature, inspect the complete transitive license set, and ship notices for every bundled dependency.

## Product behavior

### Public release scope
- Main areas: Calculator, Graphs, Algebra & Equations, Calculus, Matrices, and History. Use phone-friendly navigation and keep the keypad/editor available where entering expressions.
- Calculator: arithmetic, powers, parentheses, `pi`, `e`, `sin`, `cos`, `tan`, `log`, `ln`, `sqrt`, and `abs`; radians/degrees; implicit multiplication; cursor-aware token insertion; clear syntax/domain errors; finite checked results.
- Algebra transformations: simplify, expand, factor, and solve for a selected variable. Show the resulting expression and supported rule/step trace. Preserve domain restrictions when cancellations could change where an expression is defined; label transformations as conditional when the engine cannot prove equivalent domains.
- Equations: parse `left = right`; exact/decimal linear and quadratic answers where supported; higher-degree/general one-variable numerical roots within a user-provided interval, reporting that finite search can miss roots; linear systems with distinct unique/inconsistent/underdetermined outcomes.
- Calculus: symbolic derivatives; symbolic antiderivatives for common supported elementary forms; definite integrals using symbolic evaluation when available and adaptive numerical integration when not, always showing whether an answer is exact or approximate. If an antiderivative is unsupported, say so plainly instead of fabricating one.
- Matrices: enter rectangular matrices and support addition, multiplication, transpose, determinant, inverse where defined, solve `Ax=b`, rank, and eigenvalues/eigenvectors for supported real matrices. Enforce shape/domain rules and report singular, inconsistent, or unsupported cases.
- 2D graphs: one or more `y=f(x)` expressions, labeled axes/grid, pan/zoom, and path breaks for undefined or non-finite samples.
- 3D graphs: one or more real surfaces `z=f(x,y)`, bounded user-controlled x/y ranges and sampling resolution, rotate/pan/zoom gestures, axes, and clear breaks for invalid samples. Do not silently clamp excessive resolution; validate it and explain device/resource limits.
- Explanations: show calculation steps for arithmetic, supported algebraic transformations and equation procedures; show the differentiation/integration rule and substitutions used when available; show row-operation steps for matrix reduction/solving when reliable. A final result without a valid step trace must be labelled as such, never dressed up as a derivation.
- History: save inputs, feature kind, result/exactness, and timestamp locally in IndexedDB; restore the selected feature/input; delete one entry or clear all. Provide an explicit clear-history action.
- Interface: Russian initially, localization-friendly strings, responsive iPhone layout, keyboard focus visibility, accessible labels, and reduced-motion support. Keep the chosen graphite/green mathematical-instrument direction distinct from other calculator brands.

### Delivery milestones (all must pass before the first public release)
1. **Offline PWA shell and math input:** responsive app navigation, manifest/install metadata, service-worker precache, IndexedDB foundation, editor/keypad, scientific evaluation, and history.
2. **Algebra and equations:** expression adapters, simplify/expand/factor/solve-for-variable, exact supported linear/quadratic solving, interval-based numeric roots, linear systems, and honest status/step output.
3. **Calculus:** symbolic derivative/antiderivative adapters, supported rule explanations, adaptive numerical definite integration, result classification, and test coverage.
4. **2D and 3D plotting:** graph sampler, canvas-based 2D plot, Three.js surface renderer, interaction controls, WebGL failure handling, and sampling limits.
5. **Matrices and release hardening:** matrix operations, rank/eigen features, all-feature navigation/history, Russian copy/accessibility, offline/deployment acceptance, dependency/license notices, and release validation.

Milestones are implementation and review gates, not separate public versions. Do not describe the first public release as complete until every public-release feature has passed its tests and the deployment/device checks in the success criteria.

## Candidate references reviewed
- [Nerdamer 2 README](https://github.com/jiggzson/nerdamer#readme)
- [Nerdamer 2.0.0 npm metadata](https://registry.npmjs.org/nerdamer/2.0.0)
- [Math.js symbolic algebra documentation](https://mathjs.org/docs/expressions/algebra.html)
- [Math.js eigenvalues documentation](https://mathjs.org/docs/reference/functions/eigs.html)
- [Math.js determinant documentation](https://mathjs.org/docs/reference/functions/det.html)
- [Math.js inverse documentation](https://mathjs.org/docs/reference/functions/inv.html)
- [Math.js 15.2.0 npm metadata](https://registry.npmjs.org/mathjs/15.2.0)
- [Three.js documentation](https://threejs.org/docs/)
- [Three.js 0.187.0 npm metadata](https://registry.npmjs.org/three/0.187.0)

## Success criteria
- Automated tests establish parser precedence/implicit multiplication, scientific-function behavior, finite/domain errors, exactness labeling, simplification/expand/factor/solve-for-variable coverage, equation/system classifications, roots/residual checks, derivative/integral support and fallbacks, matrix operations/eigenvalue boundaries, and graph sample breaks.
- Every expression received from the UI is treated as data by parsers/libraries; never compile user expressions with `eval`, `new Function`, or equivalent dynamic code generation.
- Playwright tests on Windows validate responsive navigation, core feature workflows, error states, history persistence/deletion, browser reload, first-load/service-worker lifecycle, and offline behavior after the app shell has been cached.
- A production bundle audit confirms the app and math/rendering libraries are local to the deployment, third-party notices are present, and no feature depends on a remote script/API.
- Joint manual iPhone Safari acceptance on iOS 17 or later verifies GitHub Pages HTTPS Add to Home Screen, launch from the Home Screen, calculations while offline after first installation, persisted history, 2D pan/zoom, 3D rotate/zoom/WebGL fallback, and readable/accessibility-friendly UI.
- Every returned exact/approximate/no-solution/unsupported outcome is clearly distinguished; tests include a control case for each exposed feature so unsupported inputs do not become false success-shaped output.

## Builder decisions
- Confirm a pinned, license-compatible dependency set with a small compatibility/feature-coverage spike before implementing product screens; keep library-specific code behind app-owned TypeScript interfaces.
- Choose package splitting/lazy loading and service-worker precache strategy to keep first load and offline cache practical for mobile storage.
- Configure the app for GitHub Pages base paths and static deployment; publish only once a user-owned repository and access are available.
- Select symbolic-calculus coverage, numerical tolerances, solver search/refinement rules, matrix size limits, 3D resolution limits, and error copy based on measurable tests and device constraints; unsupported cases must be explicit.
- Design the phone navigation, editor ergonomics, 2D/3D controls, result/step hierarchy, and history reopen flow to match the chosen visual direction.
- Add the Git repository only inside the approved project folder and commit only project files.
