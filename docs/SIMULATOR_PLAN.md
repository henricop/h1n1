# Simulator execution plan

The active scope replaces the dense editorial experience with H1N1 Infection Simulator. The reference briefs are the two user attachments from 2026-11-06.

1. Establish an isolated Vite app and shared engine/rendering contracts. Preserve historical work, but make root commands launch only the simulator.
2. Build a seeded fixed-step engine: moving viruses, approach/adhesion, infection, replication, immune pursuit/neutralization, recovery, time/extinction limits, bounded entities.
3. Render a navigable microscopic 3D chamber using WebGPURenderer with WebGL 2 fallback, compatible node materials, instanced repeated forms, and cinematic/manual cameras.
4. Integrate live metrics, play/pause, speed, viral seeding, defense intensity, scenario presets, reset with seed, and cell inspection in an accessible responsive interface.
5. Validate engine invariants and determinism with Vitest; build/typecheck; exercise real browser flows, console, renderer backends, mobile, performance, and capture screenshots when the authorized integration is available. Record any unavailable gate as unverified.
6. Document commands, demonstration rules, renderer/device limitations, and verification evidence. Run the new product locally, without API/database/LLM/network services.

Acceptance: a real interactive simulation; consistent counters; deterministic reset; all requested controls; 60/80/5 defaults; browser-only runtime; WebGPU + WebGL 2 support; reference targets of 60 desktop / 30 mobile FPS measured rather than assumed; no console errors in tested flows; real screenshots and browser QA; no placeholders.

## Delivery evidence

Implemented in `apps/simulator`. Root commands and CI target the static browser simulator. The optimized production preview runs on port 3000 without the legacy API. TypeScript, production build and 27 tests pass. Real authorized extension audits cover WebGPU and WebGL 2, desktop and 390×844 viewport, all controls, actual canvas raycasting, conservation, seed/reset, rendering changes, completion/resume and screenshots. Measurements and device-specific limits are recorded in `SIMULATOR_VALIDATION.md`; mobile-width testing on the reference Mac is not a physical-phone benchmark.
