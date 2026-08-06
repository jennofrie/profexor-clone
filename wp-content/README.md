# Profexor frontend assets

This directory mirrors the public path structure of the compiled WordPress
theme while remaining deployable as a static site.

```text
wp-content/
├── themes/
│   └── gl/
│       ├── public/build/assets/      # Compiled CSS, JS modules, and fonts
│       └── resources/
│           ├── favicon/              # Favicons and web manifest
│           └── js/GL/                # WebGL sources, shaders, DRACO, GLBs
└── uploads/                           # Excluded from Git; served by media origin
```

## Compiled theme

The site references production-ready Vite output directly from every standalone
HTML page.

| Path | Role |
|---|---|
| `themes/gl/public/build/assets/app-DZbACm4C.css` | Compiled layout, typography, and motion styles. |
| `themes/gl/public/build/assets/app-profexor-v2.js` | Immutable Profexor production entry module. |
| `themes/gl/public/build/assets/*-profexor-v2.js` | Coordinated versioned lazy-module graph. |
| `themes/gl/public/build/assets/*.woff2` | Bundled display and monospace fonts. |
| `themes/gl/resources/js/GL/` | Three.js/GPGPU sources and model assets. |

The previous compiled graphs remain in the repository for rollback. Production
HTML points only to the current v2 entry graph.

## WebGL assets

`themes/gl/resources/js/GL/sources/` contains the current Profexor display and
hitbox meshes:

- `profexor-wordmark-v2.glb`
- `profexor-wordmark-hitbox-v2.glb`

Their deterministic generator and integration checks live in
[`../tools/profexor-model/`](../tools/profexor-model/README.md). Runtime details
live in [`themes/gl/resources/js/GL/README.md`](themes/gl/resources/js/GL/README.md).

## Uploads and media

Large `.mp4`, `.jpg`, and `.jpeg` uploads are intentionally excluded from the
repository. In production, Netlify rewrites `/wp-content/uploads/*` to the
read-only media service at `media.profexer.cloud`, preserving the original URL
shape and byte-range video playback.

See [`../ops/media-origin/README.md`](../ops/media-origin/README.md) for the
service definition and verification commands.

Maintained by **Profexor**.
