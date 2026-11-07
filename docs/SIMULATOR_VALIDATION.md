# Evidências de validação — Jornada da Infecção

Data: 2026-11-07. Aplicação ativa: `apps/simulator`. Build de produção servido localmente em **http://127.0.0.1:3000** com `pnpm start`. Nenhum projeto ou artefato foi publicado em hospedagem cloud.

## Verificações de código

- TypeScript: passou.
- Vitest: **84 testes**, nove arquivos. Incluem a engine microscópica preservada, engine regional, store, UI, estados visuais e recursos 3D.
- Build de produção: passou; resultado estático em `apps/simulator/dist`.
- Descoberta Playwright CLI: **12 casos**, seis desktop e seis mobile. A descoberta não equivale à execução do navegador pelo CLI.

Cobertura relevante: relógio fixo independente de frames, seed/replay, cinco regiões, índices limitados, conservação das posições celulares, reposição com novas identidades, eventos sem retroação, isolamento A/B, edição/desativação/remoção, restauração exata do baseline, caches limitados e navegação sem mudar o estado biológico. Testes gráficos carregam os GLBs reais, verificam topologia/atributos finitos e descarte correto das geometrias compartilhadas.

## Navegador real

Todas as interações foram executadas pela extensão oficial do Codex através do transporte `setupBrowserRuntime()` e da API Playwright documentada. A fachada CUA havia retornado “The browser access host is unavailable”; o transporte oficial expôs as extensões conectadas. Foram criadas abas sob controle do agente. Não foi usado CDP, AppleScript, perfil pessoal ou automação independente como alternativa.

O auditor reproduzível `apps/simulator/scripts/validate-journey.mjs` recebe handles oficiais `browser`/`tab`; não inicia nem anexa um navegador. Ele salva JSON e screenshots em `.qa/journey/`.

| Execução | Largura | Backend | Amostras FPS em execução | Geometrias ao retornar ao corpo | Erros de console |
| --- | --- | --- | --- | --- | --- |
| Desktop | 1470 px | WebGPU | 60, 60, 60, 60 | 16 → 16 → 16 → 16 | 0 |
| Layout móvel | 390 px | WebGL 2 | 60, 60, 60, 60 | 16 → 16 → 16 → 16 | 0 |

Referência: Apple M4, Mac16,12, Chrome 156.0.8078.80. O layout móvel usa viewport 390 × 844 no mesmo Mac. **Não é medição em um telefone físico.** Os números são amostras do contador real do renderer após compilação, não garantias em qualquer hardware. O teste de recursos percorre três ciclos das cinco escalas, com retorno ao mesmo contexto. Contagem de geometrias é um indicador de estabilidade, não uma medição de bytes de memória da GPU.

Cada execução passou 15 grupos: abertura com relógio em andamento; corpo como escala inicial; backend real; ausência de overflow; pausa estável; cinco escalas com relógio/seed preservados; seleção de célula real; adversidade com divergência A/B; desativação restaurando baseline; remoção restaurando baseline; recursos limitados após 15 trocas; redução de movimento; controles de câmera; FPS amostrado; ausência de erros.

Além do auditor, um clique real no centro do tecido selecionou uma célula por raycasting e navegou para a cena intracelular, mantendo hora 72, seed 2009 e cenário A. O fluxo de leitura em diálogo pausa o relógio e restaura a reprodução anterior ao fechar. Uma recarga local com cache chegou à cena pronta em 569 ms (medida externa da integração, não benchmark de rede fria). O último GLB/material também foi conferido em WebGL a 390 px, com relógio avançando e 60 FPS.

## Evidências visuais

Arquivos locais sob `.qa/journey/`:

- `final-composition.png`: corpo anatômico inteiro no começo, com controle “Pausar”.
- `desktop-webgpu-body-running.png`: abertura em andamento.
- `desktop-webgpu-lung-day3.png`: lobos e árvores brônquicas.
- `desktop-webgpu-tissue-day3.png`: epitélio curvo conectado.
- `desktop-webgpu-cell-day3.png`: célula selecionada.
- `desktop-webgpu-event-editor.png`: evento de sono com intensidade alta no dia 3.
- `desktop-webgpu-comparison-day6.png`: A/B no mesmo instante.
- `desktop-webgpu-final.png`: corpo em um dia posterior.
- `mobile-webgl-body-running.png` e demais `mobile-webgl-*`: percurso móvel e backend alternativo.
- `desktop-webgpu.json`, `mobile-webgl.json`: verificações, FPS e recursos.

A primeira versão densa foi substituída após avaliação do usuário. A primeira malha MakeHuman também foi substituída pelo corpo BodyParts3D em pose anatômica natural. Capturas reais orientaram os ajustes de contraste, iluminação, transparência localizada no tórax, enquadramento sem cortar a cabeça, posição da cena e contraste dos pulmões. O último corpo tem AO geométrica pré-calculada, sem pós-processamento ou textura remota.

## Limites verificados e restantes

Os modelos de corpo e pulmão são locais e texturizados por materiais de nós comuns aos dois backends, com licenças/créditos distribuídos. O build não exige serviços remotos. O atlas mistura referências distintas em uma composição didática explicitamente esquemática.

Há tratamento de erro de inicialização e perda de contexto gráfico. Não se forçou perda de contexto por uma API de automação alternativa: esse teste de falha permanece uma validação específica de dispositivo/driver. Também não foi feita auditoria independente WCAG nem benchmark em telefone físico. Esses limites não devem ser apresentados como verificações concluídas.

## Ajuste após referência em vídeo

Referência fornecida pelo usuário: https://x.com/emmanuel_2m/status/2098058975195308130. Vídeo público de 40 segundos baixado localmente para análise visual; quadros em `.qa/reference/`. Foram observados catálogo de peças, seleção destacada, foco, órbita e isolamento; controles de explosão/seção aparecem na interface da referência. A análise não atribui ao H1N1 funcionalidades ainda não implementadas.

A nova captura do usuário expôs manchas de transparência e um corpo inteiro ampliado indevidamente na escala respiratória. A superfície humana passou a usar profundidade e material sólido com janela anatômica, eliminando a sobreposição de triângulos translúcidos. A escala respiratória agora isola as vias/pulmões e enquadra o conjunto sem ampliar o restante do corpo. Capturas reais: `solid-body.png` e `isolated-respiratory.png`. Build e 73 testes passaram; materiais conferidos em WebGPU e WebGL 2 sem erros de console.

## Current Human Atlas / H1N1 integration

This supersedes the earlier minimal body renderer for macroscopic views. The user selected Human Atlas and then requested camera freedom and disease focus. The default now shows the H1N1 respiratory route with five real simulation regions. Complete anatomy, layers and explosion remain available as a secondary exploration mode.

- **79 Vitest tests**, TypeScript and production build pass. New checks validate all 2,234 pieces, 3,432 concept memberships, every binary position/index, gzip/raw responses, nonoverlapping exploded packing, Portuguese lookup, anatomical region mapping and tap-versus-drag/multi-touch handling.
- Microscopic rendering is loaded separately; initial main bundle ~1,018 kB (277 kB gzip), deferred microscopic bundle ~793 kB (232 kB gzip). The anatomical data is a separate ~33 MB compressed local download.
- `scripts/validate-atlas-browser.mjs` ran through the official extension at 1470 px and 390 × 844. Each passed 15 groups: automatic H1N1 clock, responsive layout/backend, pause stability, five regions, zoom, pan mode, keyboard pan/orbit, search/selection/isolation, shared clock through tissue/cell, causal A/B event, bounded resources, optional full anatomy/explosion, rotation sampling and no console errors.
- Atlas renderer geometry counts returned **22 → 22 → 22** after unloading microscopic scenes and returning to the same H1N1 context. The full atlas legitimately uses more buffers after additional systems are made visible (76 in that run); it is a different scene, not a repeated-context growth measurement.
- Default focused H1N1 view measured 60 FPS. Full-atlas skeleton rotation samples varied: desktop 60/23/43; mobile-width 60/50/48 on the same Apple M4. These include view/geometry transitions and do not establish physical-phone performance or universal 60 FPS.
- Camera controls provide explicit orbit/pan modes, zoom-to-cursor, zoom buttons, reframe, standard anatomical views, arrows for pan and Shift+arrows for orbit. Screenshot changes verified keyboard pan/orbit and button zoom. No native browser automation or physical multitouch test was used.
- Captures: `h1n1-atlas-desktop-*`, `h1n1-atlas-mobile-*`; structured evidence: `h1n1-atlas-desktop.json`, `h1n1-atlas-mobile.json` under `.qa/journey/`.

The HRA supplementary contour is schematic. The engine does not model infection of every visible anatomical structure. Optional full-body exploration is educational context and preserves the main H1N1 clock.

Final movement refinement: biological updates now change only the regional color texture; they no longer recompute the 2,234 picker matrices, explosion layout or translation texture. A real-browser profile exposed the unnecessary update cost. After separating those paths, four running focused-view samples measured **60/60/60/60 FPS**, with simulated hours advancing 6 → 9 → 12 → 14. Evidence: `.qa/journey/h1n1-final-frame-samples.json`. Manual camera position is preserved across biological changes. This focused-view result does not replace the separate full-atlas/physical-device limits above.

## Persistent person state, viral control and milestones

The latest local build adds a persistent simulated-person monitor across body, tissue and cell scales. It shows the engine's body stage, involved regions and two internal indices; symptoms are labeled narrative possibilities rather than computed measurements. A direct 1×–3× control changes cellular contact pressure and replication in scenario B starting the following simulated hour. Scenario A and prior hours remain unchanged. Milestone cards use the engine's threshold log, with short text and a route to the corresponding 3D state.

The 3D semantic layer displays bounded regional virus/defense/damage/repair actors. Microscopic cell shape and particle paths depend on the same fractional simulation clock as play, pause and seek. An initial real-browser check caught an invalid merged spike mesh, which was fixed by making all merged geometries non-indexed and adding a geometry regression test. The corrected local production preview rendered the body at **WebGL 2 · 60 FPS**, tissue at **WebGPU · 60 FPS** and cell at **WebGPU · 58 FPS** in one desktop-width session; no errors were recorded for the corrected asset. These are single-session readings, not device-independent benchmarks. Vitest: **84 passing tests across nine files**; production build and TypeScript passed. The current extension session did not expose viewport resizing, so the latest layout changes have not been visually rechecked at mobile width in this pass.
