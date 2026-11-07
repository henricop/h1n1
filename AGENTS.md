# H1N1 · Jornada da Infecção

- The active product is `apps/simulator`: React + TypeScript + Vite, entirely in the browser. Root commands target this app.
- Historical Next.js, API and data packages are retained as legacy source only. Do not reconnect them to the simulator or discard pre-existing local work.
- Separate deterministic logic (`src/engine`), Three.js rendering (`src/graphics`), and React controls. Publish UI snapshots at most 10 times/second; never set React state per animation frame.
- Use a fixed simulation step, seeded randomness, bounded populations, shared instanced geometry, and explicit renderer disposal. Metrics must come from the engine.
- Current specification: `docs/HUMAN_JOURNEY_SPEC.md`. Start with a full navigable 3D human body, then respiratory system, lung region, connected epithelial tissue and a selected cell. All five scenes use one contextual region registry and simulation clock.
- The active educational core advances in fixed one-hour steps over 14–21 days, with seeded snapshots/replay and independent scenario A/B branches. The original microscopic engine and geometry remain available for reuse and regression checks.
- Adversities must change actual model parameters, with causal factors stored in the event log. Never attach symptoms or stage changes to hard-coded day numbers. Damaged cells are removed/replaced with new identities; tissue repair is separate from cell state.
- These are qualitative demonstration rules and internal indices, not clinical predictions, laboratory measurements, drug doses or therapeutic efficacy.
- Validate with Vitest, TypeScript, production build, and browser QA through the authorized Codex browser integration only. Do not substitute native browser automation when that integration is unavailable.
- Parallel agents may own engine, graphics, and tests independently; coordinate shared interfaces before editing. No Plannotator.

- If CUA reports an unavailable browser host, inspect the enabled official Browser plugin and its trusted Node REPL transport before asking the user to repair anything. The official `setupBrowserRuntime()` transport may expose connected extensions even when the CUA inventory is unavailable. Keep all browser actions in that authorized integration; never attach standalone automation to a personal profile.

- The current user direction requires a light clean 3D-first interface and automatic playback on opening. The original brief's paused start and three-column dashboard are superseded.
- Local development, build, validation and preview only. Never register, upload, synchronize or publish this project through OpenAI cloud, ChatGPT Sites, chatgpt.site or related services. A different provider requires the user's explicit selection and deployment request.

- Latest user direction: use the open Human Atlas basis for actual anatomical exploration, improve camera freedom, and keep H1N1 as the default focus. `src/atlas` owns macroscopic views; the complete 15-system atlas is optional context. Maintain upstream MIT and BodyParts3D/HRA attribution. The shared app clock drives both the atlas and microscopic renderer; neither may advance a second clock.
