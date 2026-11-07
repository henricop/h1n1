# Anatomy assets and visual mapping

## Distributed human surface

The visible full-body surface is **BodyParts3D 4.0, adult male skin (`FJ2810.obj`, `FMA7163`, `BP10155`)** from the official Database Center for Life Science archive. The natural anatomical stance has arms close to the body, recognizable facial features, chest/abdomen contours, hands/fingers, knees and feet. It replaces the earlier MakeHuman prototype base, whose broad A-pose and unmorphed face read as a game mannequin in real-browser screenshots.

- Exact source: [official PART-OF polygon archive](https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/partof_BP3D_4.0_obj_99.zip), member `partof_BP3D_4.0_obj_99/FJ2810.obj`, 14,465,506 bytes, 203,382 source triangles.
- Source SHA-256: `50fb17d0b3559b8b6c5481dbe7f877d25726e576564da615c45b2dd7654e315d`.
- Required attribution: **BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International**.
- License: **CC BY 4.0**, explicitly stated by the [current official license page](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html), updated 2025-02-27. The [official README](https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/README_e.html) states that the same terms cover redistribution and adaptation of part/all of this database. The historical 2013 OBJ header mentions the older CC BY-SA 2.1 Japan terms; the current database licensing is documented here and in `BODYPARTS3D-CC-BY-4.0.txt`.
- Citation: Mitsuhashi N, Fujieda K, Tamura T, Kawamoto S, Takagi T, Okubo K. *BodyParts3D: 3D structure database for anatomical concepts.* Nucleic Acids Research (2008), [PMID 18835852](https://pubmed.ncbi.nlm.nih.gov/18835852/).
- Local optimized asset: `apps/simulator/public/models/human-body.glb`, **1,954,672 bytes**, **48,810 positions**, **97,620 triangles**. SHA-256: `351c950445fa8f943b90aab22988ad52a37b66399bc413a11b14c7651eef3871`.
- Conversion: weld positions, error-bounded simplification, recompute smooth normals, convert millimetres and axes into the atlas frame. Natural source stance retained. Source/license/FMA identity and modifications remain in GLB extras. A small-radius 24-ray geometric ambient-occlusion factor is baked into normalized vertex colors, helping real eye/nose/ear/finger creases read without any runtime shadow pass or texture. AO is strongly attenuated on broad torso/arm/leg surfaces so historical source seams do not become dark skin spots. All geometry remains orbitable actual 3D.
- Offline reproduction: `node apps/simulator/scripts/prepare-human-body.mjs /path/to/FJ2810.obj`. The workspace's Meshoptimizer 1.1.1 and three-mesh-bvh 0.8.3 are used only during conversion; they add no runtime dependency or network request.

## Distributed expert-reviewed lung anatomy

The lung surfaces and intrapulmonary bronchial trees now use **Human Reference Atlas / HuBMAP, 3D Reference Organ for Lung, Female v1.4**, created by **Kristen Browne and Heidi Schlehlein (2024)** from the National Library of Medicine's Visible Human Female dataset.

- Permanent source and citation: [doi:10.48539/HBM994.HXJP.575](https://doi.org/10.48539/HBM994.HXJP.575), [reference object](https://purl.humanatlas.io/ref-organ/lung-female/v1.4).
- Exact downloaded asset: [HRA CDN GLB](https://cdn.humanatlas.io/digital-objects/ref-organ/lung-female/v1.4/assets/3d-vh-f-lung.glb), 23,255,188 bytes; original SHA-256 `101f48ec64f2ed762fde03fc1193eaae583a0d35c47b72a9ca007d72eefb5f71`.
- License and creators verified in the [official version-specific metadata](https://cdn.humanatlas.io/digital-objects/ref-organ/lung-female/v1.4/metadata.jsonld): **CC BY 4.0**. Full attribution, license links and modifications ship at `/models/ATTRIBUTION.md` and `/models/HRA-CC-BY-4.0.txt`.
- The [official library](https://hubmapconsortium.github.io/ccf/pages/ccf-3d-reference-library.html) describes specialist medical illustration and organ-expert approval. This adaptation does not inherit a claim of clinical registration or clinical accuracy for the simulator.
- Distributed asset: `apps/simulator/public/models/respiratory-atlas.glb`, **2,937,088 bytes**, **81,810 positions**, **159,849 triangles**, **7 meshes**: five named lung lobes and left/right intrapulmonary bronchial trees. No textures or decoder dependency.
- Local SHA-256: `a48b69c6b65f667056cea168aa14160d13668c9165925dcf90aa69d7354052bd`.
- Conversion: exclude hilum helper surfaces; retain bronchopulmonary segment and bronchial identity/ontology metadata; merge by source lobe and bilateral tree; weld duplicate positions; error-bounded simplification with locked borders using Meshoptimizer; discard unused attributes/materials and recompute smooth normals. Source segment interfaces remain part of the original anatomy. The offline conversion is reproducible with `node apps/simulator/scripts/prepare-respiratory.mjs /path/to/3d-vh-f-lung.glb` (Meshoptimizer 1.1.1 is present in the workspace lockfile; it is used only during conversion).
- Fit is explicitly schematic: body overlay bounds X −1.030…1.030, Y 1.85…3.857, Z −0.454…0.553; adapted from the original full-body coordinate frame to the BodyParts3D human surface. This fit is an educational composition, not patient anatomy.

### Sources compared before selection

| Official source | Strength and terms | Decision |
| --- | --- | --- |
| [HRA / HuBMAP](https://humanatlas.io/3d-reference-library), mirrored by [NIH 3D](https://3d.nih.gov/entries/21008?version=1) | Specialist illustration, organ-expert review, real lobes and detailed intrapulmonary bronchi, rich ontology metadata. Version-specific CC BY 4.0. | Selected and optimized from 23.3 MB to 2.94 MB; gives much richer anatomy than procedural ovals. |
| [BodyParts3D / DBCLS](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html) | Full-body OBJ atlas and trachea; the [current official README](https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/README_e.html) updated 2025-02-25 specifies **CC BY 4.0** (older secondary sites still mention an earlier ShareAlike license). Full polygon package is roughly 62 MB. | Selected the natural-stance adult skin surface to replace the mannequin-like prototype. HRA remains the more detailed segmented source for the respiratory organs; their overlay fit is schematic. |
| [Z-Anatomy](https://github.com/LluisV/Z-Anatomy) | Large complete atlas, CC BY-SA 4.0 and packaged desktop/FBX content. | No geometry or code copied. The focused HRA source provides the needed lung anatomy with simpler attribution and bounded delivery. |

## Authored upper respiratory and microscopic geometry

HRA v1.4 deliberately excludes larynx, trachea and main bronchi. The nasal cavity/pharynx, cartilage-ringed trachea, primary bronchial connectors and representative alveolar units remain named authored Three.js meshes/tubes. They are educational approximations, identified separately from the HRA-derived lobes and intrapulmonary trees. The old procedural lung generator is retained only as a lightweight geometry/test fallback; production loads the local HRA asset and does not display the simplified lung ovals.

The body coordinates match `src/journey/anatomy.ts`: nose near Y 4.76; trachea near Y 3.85; carina near Y 3.45. Each pickable structure carries its actual `regionId`. The same source meshes are used in whole-body, respiratory and lung views, with a known organ-scene transform. Tissue and cell views read the selected region and cell slot from the shared snapshot.

Epithelial tissue is a curved connected respiratory wall, with a continuous curved basal layer and shared mucus film. Columnar cells, nuclei, organelles and instanced cilia follow the local surface normals while retaining stable engine slot identities. This avoids a flat board of disconnected tiles. Nucleus/organelles and eight illustrative viral RNP strands appear in the intracellular scene. Damaged/removed/recovering appearances read the real cell state and replacement generation managed by the engine. Viral and immune figures are representative actors bounded by regional counters; they never claim to be literal organism-wide particle counts.

The existing recognizable influenza surface geometry (rounded HA heads, squared NA heads) is reused under the project source's license. The project adds its own TSL membrane material; a common node graph compiles for both WebGPU and WebGL 2. No third-party texture, font or remotely loaded model is required in runtime. The local GLB is fetched from the same origin as the static app.

## Rendering/resource policy

Only one of the five anatomical scales is active. Scale changes dispose that scale's geometry/materials/instance buffers, keeping the shared body and seven HRA geometry buffers until renderer disposal. Original loaded materials are disposed immediately; each active scene gets owned materials, which are disposed on the next scale change. Shared geometry is disposed exactly once at final renderer disposal. Every actor is instanced in tissue views. The renderer reports actual backend, frame counter, geometry/texture counts, draw calls and triangles; FPS and visual compatibility still require real-browser evidence.

## Light-stage visual mapping and framing

The product stage uses a light `#f5f7f8` background, neutral studio lighting, a matte neutral porcelain human surface with a localized translucent thoracic window and clear blue airways. Rose activity, amber damage/inflammation and immune blue remain localized to the actual selected region and cell state. The whole-body camera fits the complete human with clearance below the breadcrumb and margin for feet; closer scales anchor the selected region rather than flying through arbitrary coordinates. Body and lung topology are actual 3D, orbitable meshes; no SVG anatomical silhouette or image substitutes for geometry.

The first real-browser screenshot exposed low lung alignment, which was corrected to thoracic height. The newer HRA geometry supersedes the earlier authored oval lung surfaces, with anatomical lobe fissures, asymmetry and true intrapulmonary branching. Actual browser checks and GPU resource stress remain part of the root QA workflow; CPU tests verify finite source positions/normals, compact asset size, five lobes/two trees, all five active scenes and no disposal of shared geometry during scene swaps.

### Solid-surface revision after video reference

The full-body surface now uses an opaque, depth-writing matte material and an alpha-tested anterior thoracic window instead of whole-surface transparency. This avoids the closed mesh's unsorted transparent-triangle artifacts. Respiratory scale isolates the actual airway/lung structures; the full-body surface is only present at organism scale. The same body source geometry and attribution remain unchanged.

## Complete Human Atlas integration — current macroscopic renderer

The user explicitly selected https://human-atlas.online/ and then required better camera freedom and a focused H1N1 experience. The macroscopic views now use locally adapted MIT code and the complete BodyParts3D package from https://github.com/ashemag/human-atlas, commit `1c38bf35c254a891200d3cedecfd57abebe83d8d`.

- `src/atlas/`: typed, adapted renderer, compressed-model decoder, pointer gesture handling and nonoverlapping explosion layout. Full MIT notice is shipped in `public/models/atlas/HUMAN-ATLAS-MIT.txt`.
- `public/models/atlas/`: 2,234 individually indexed source meshes, 3,432 named concepts, 15 display systems, 2,288,268 triangles. Approximately 33 MB compressed geometry, with uncompressed local fallbacks. All source identities and concept membership are retained; tests validate every binary position and index.
- No upstream cloud/deployment plugins, hosting configuration, account integration or agent tool registration was imported. No project was registered or synchronized. All runtime model requests are same-origin local files.
- Default: respiratory anatomy and selected skeletal support, five simulated H1N1 regions and illustrative localized viral actors. Full anatomical exploration and explosion are optional. Source data does not contain every anatomical surface: the lung concepts group bronchial/vascular pieces. The separately licensed HRA lung envelope provides schematic contextual lobes; it is not included in the 2,234 BodyParts piece count.
- HRA-to-BodyParts transform follows the actual old skin conversion: scale `1/6.572`, Y offset `5.0365/6.572 + .0781112`, Z offset `.65/6.572 - .1`. This composes different references for teaching and is not a patient registration.
- Regional activity colors and representative actors come from the shared journey snapshot, with no clinical rate claims. Geometry outside the respiratory model is contextual anatomy, not simulated disease.
- The shared application clock advances independently of either renderer. UI publishes at 125 ms. Anatomy and microscopic scenes retain the same clock, seed, branch and selected region.
