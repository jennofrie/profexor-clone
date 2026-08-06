# Profexor wordmark models

This tool generates the versioned Profexor model pair used by the existing
Three.js animation engine:

- `profexor-wordmark-v1.glb`: densely remeshed particle/effect geometry.
- `profexor-wordmark-hitbox-v1.glb`: lower-density mouse raycast geometry.

The models use the site's bundled Druk Wide font and retain the exact bounding
boxes of the working Artefakt models. The legacy model files remain untouched
for rollback. Versioned output names avoid the site's immutable GLB cache.

Run from this directory:

```sh
npm install
npm test
npm run generate
npm run integrate
```

Generation fails if topology, density, edge length, bounds, or output size
falls outside the checked limits in `model-config.mjs`.

`npm run integrate` creates an immutable-cache-safe copy of the complete
reachable JavaScript module graph, rooted at `app-profexor-v1.js`, and updates
every HTML preload/script reference. Versioning every lazy chunk prevents a
second copy of Three.js from being loaded. The previous production graph is
retained for rollback.
