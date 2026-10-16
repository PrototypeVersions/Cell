# Cell

An interactive 3D eukaryotic cell built as a concept for exam-prep explanations.

**Live:** https://prototypeversions.github.io/cell/

- **Explore** – rotate the cell, open the cutaway, and click any structure for what it does and what exams ask about it.
- **Question** – an original USMLE-style vignette (I-cell disease). After you answer, the explanation plays out inside the cell: a lysosomal enzyme's route from rough ER to Golgi to lysosome, then the same route with the mannose-6-phosphate tag missing.
- **Spot it** – click-the-structure prompts answered directly on the model.

Every shape is generated in code with [three.js](https://threejs.org) (vendored in `vendor/three`, MIT). There are no external 3D models. Rendering uses ambient occlusion, soft shadows, and a transmissive membrane; lower-powered devices get a lighter pipeline.

## Files

- `js/cell.js` – procedural geometry for every organelle and the cutaway
- `js/pathway.js` – the animated explanation
- `js/content.js` – all educational text (organelle facts, the question, Spot-it prompts)
- `js/render.js` – post-processing (clipping-aware ambient occlusion)
- `js/main.js` – interaction, camera, and UI

Run locally with any static server, e.g. `python3 -m http.server`.

Built by [Blake A. Myers](https://sites.google.com/view/blake-a-myers/home).
