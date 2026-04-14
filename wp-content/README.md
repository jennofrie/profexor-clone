# wp-content/

Static asset directory structure, mirroring a compiled WordPress theme output.

```
wp-content/
├── themes/
│   └── gl/
│       ├── public/build/       # Vite-compiled CSS and JS bundles
│       └── resources/
│           ├── js/GL/          # WebGL source — Three.js, GLSL shaders, DRACO loader
│           └── favicon/        # All favicon sizes and web manifest
└── uploads/                    # Media assets (excluded via .gitignore — host externally)
```

## themes/gl

The `gl` theme contains the compiled frontend. Key artifacts:

- `public/build/assets/app-*.css` — Tailwind CSS output, custom animations
- `public/build/assets/app-*.js` — Bundled JavaScript (GSAP, Three.js, custom web components)
- `resources/js/GL/` — Original WebGL source before bundling (Three.js particle system, GLSL shaders, DRACO decoder)

## uploads/

Media files (`.mp4`, `.jpg`, `.jpeg`) are not included in this repository due to file size and copyright. Serve these assets from a CDN or local media server when running the site.
