# Anatomical model credits

## Human surface

**BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International**

- Source: [BodyParts3D 4.0 official PART-OF polygon archive](https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/partof_BP3D_4.0_obj_99.zip), `FJ2810.obj`, skin — `FMA7163` / `BP10155`.
- Official [current license](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html), updated 2025-02-27: **CC BY 4.0** — https://creativecommons.org/licenses/by/4.0/
- The archived 2013 OBJ header refers to the older CC BY-SA 2.1 Japan license. The current official database license explicitly permits redistribution and adaptation under CC BY 4.0.
- Local notice: BODYPARTS3D-CC-BY-4.0.txt
- Adaptation: welded duplicate positions, error-bounded simplification, recomputed smooth normals, millimetre/axis conversion into the educational atlas frame. Natural anatomical stance retained; small-radius geometric ambient occlusion baked into vertex colors without a texture. Distributed as `human-body.glb`. No original textures or materials used.
- Adult male reference anatomy. Citation: Mitsuhashi N, Fujieda K, Tamura T, Kawamoto S, Takagi T, Okubo K. *BodyParts3D: 3D structure database for anatomical concepts.* Nucleic Acids Research (2008). https://pubmed.ncbi.nlm.nih.gov/18835852/

## Lung lobes and intrapulmonary bronchial trees

Browne, Kristen, and Heidi Schlehlein. 2024. **3D Reference Organ for Lung, Female v1.4.** Human Reference Atlas / HuBMAP. https://doi.org/10.48539/HBM994.HXJP.575

- Source: https://purl.humanatlas.io/ref-organ/lung-female/v1.4
- Original GLB: https://cdn.humanatlas.io/digital-objects/ref-organ/lung-female/v1.4/assets/3d-vh-f-lung.glb
- Official metadata and license: https://cdn.humanatlas.io/digital-objects/ref-organ/lung-female/v1.4/metadata.jsonld
- License: **Creative Commons Attribution 4.0 International (CC BY 4.0)** — https://creativecommons.org/licenses/by/4.0/
- Based on the National Library of Medicine's Visible Human Female dataset. Reference-organ illustration created by Kristen Browne and Heidi Schlehlein; distributed by HuBMAP.
- Adaptation: hilum helper surfaces excluded; segment meshes grouped into five named lobes and bilateral bronchial trees; welded/simplified geometry and new smooth normals; no source texture/materials; resized for a schematic body overlay. Original structure names and ontology identifiers retained as GLB metadata. Distributed as respiratory-atlas.glb.
- This adaptation and the simulator are not endorsed by the original creators, NLM, NIH or HuBMAP. The model is educational; its body transform and state colors do not represent a clinical registration or medical measurement.

The nasal pathway, trachea, main bronchial connectors and microscopic structures are authored simplified geometry. HRA v1.4 intentionally omits larynx, trachea and main bronchi; those authored connectors are identified separately from the source model.

## Complete anatomical explorer

The application now also includes the Human Atlas data package and adapted renderer from https://github.com/ashemag/human-atlas, pinned commit `1c38bf35c254a891200d3cedecfd57abebe83d8d`.

Application code: **MIT License, Copyright (c) 2026 ashemag**. Full notice: `/models/atlas/HUMAN-ATLAS-MIT.txt`.

Data: BodyParts3D 4.0, **CC BY 4.0**, 2,234 individual source meshes and 3,432 named concepts. Complete dataset credits and adaptation notes: `/models/atlas/ATTRIBUTION.md`.

This project's changes include Portuguese controls/search aliases, a focused H1N1 pathway, shared simulation timing, actual regional activity coloring, bounded representative viral actors, manual pan/orbit/zoom and microscopic navigation. The optional pulmonary envelope is derived from the separately credited HRA model above, transformed into the BodyParts frame for schematic educational context. It is not part of the original 2,234-piece count or a clinical registration. No external cloud hosting or model service is required in runtime.
