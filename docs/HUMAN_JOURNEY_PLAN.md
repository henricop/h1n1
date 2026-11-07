# Human journey migration

Source of truth: `HUMAN_JOURNEY_SPEC.md`, copied from the user's requested document. Preserve React/Vite/Three WebGPU+WebGL2/GSAP/Zustand and existing pure engine/geometry tests. Current baseline is a working microscopic simulator; screenshot: `.qa/journey/baseline.png`.

## Implementation milestones

1. Shared strict journey types, five-region anatomy registry, one-hour seeded regional engine, timeline snapshot/replay. Render a full recognizable human with respiratory anatomy before microscopic scenes.
2. Join organism, respiratory, organ, connected epithelium and intracellular views through known anatomical anchors. Preserve seed, current hour, selected region and scenario on navigation.
3. Implement the first playable end-to-end path: body → lung → tissue → cell → advance one day → model/scene changes → schedule adversity → changed trajectory.
4. Complete 14/21-day timeline, hourly/daily stepping, scrubbing, replay, dynamic causal milestones and "Mostrar o que aconteceu".
5. Eight-event catalog/editor with time/duration/intensity/region, modification/disable/removal, branch-local invalidation; A/B comparison with four internal-index curves and event explanation.
6. Refine anatomy/materials, clean light interface, responsive contextual panels, presentation mode, reduced motion, accessible keyboard camera/navigation, performance instrumentation and disposal.
7. TypeScript/Vitest/build, real authorized extension audits of full journey and WebGL2 fallback, required eight screenshot views, pause/replay/events/scenario invariants, repeated-scale resource checks and performance/loading observations. Document evidence, licenses and remaining device-specific limits.

## Ownership

- Root: shared contracts, registry, store, main UI/renderer lifecycle, integration, browser validation and documentation.
- Engine agent: `src/engine/journey/` and pure journey tests.
- Anatomy/graphics agent: `src/graphics/journey/`, named procedural anatomy/assets and graphics tests/credits.
- Interface agent: journey timeline/editor/comparison/chart components and their isolated stylesheet.

## Risks and gates

Avoid scripted day-based effects, unstable numeric indices, stale snapshots after editing history, retroactive event effects, coupled A/B random streams, cell resurrection, unbounded caches/GPU resources and camera resets that lose context. Keep the original app compiled until the new root integration is ready. Only the active scene is rendered. Use actual state for all statistics and explanations. External assets require redistribution-compatible licensing and attribution; if none suitable is available, build an actual recognizable procedural mesh, never a sphere collage or static body image.

## User direction update — 2026-11-07

The user rejected the dense atlas/dashboard screenshot and requested a clean design system, a much stronger focus on using 3D, didactic guidance and the best suitable anatomical models. This overrides the three-column default in the original brief. Preserve all causal/time/event/comparison functionality behind contextual sheets. The default view should present one 3D scene, a short explanation/action and compact time controls. Research higher-fidelity, redistribution-compatible anatomy assets (including HRA/NIH references), optimize them and record provenance. Use a restrained light interface; no permanent metric/sidebar dashboard.

## Final direction and implementation evidence

The later request also requires playback on opening. The UI store now starts the real engine running, and restarting starts playback. Contextual dialogs pause reading time and resume previously active playback. Direct event-log navigation remains paused for inspection.

The full-body MakeHuman base has been replaced with the official BodyParts3D adult surface in natural anatomical stance. The lung atlas remains HRA/HuBMAP with five lobes and two detailed bronchial trees. Both are optimized local CC BY 4.0 GLBs with exact attribution and reproducible preparation scripts. No OpenAI cloud/Sites registration, source synchronization or deployment is permitted; only local builds/previews are used.

Implementation milestones are complete in code. Automated checks: 73 Vitest tests, typecheck and production build. Official extension audits cover autoplay, all five scales, timeline/events/A-B baseline restoration, reduced motion, accessible camera, mobile WebGL2 and bounded geometry counts across repeated swaps. Actual captures, measured limits and remaining physical-device/context-loss checks are documented in `SIMULATOR_VALIDATION.md`.
