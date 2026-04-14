# Profexor — High-Fidelity Website Clone

A production-grade static site clone of a Frankfurt-based hybrid production studio, rebuilt with full fidelity to the original design and interactions.

Built by **[Profexor](mailto:profexor@atomicmail.io)**.

---

## Overview

This project is a high-fidelity static site reconstruction featuring:

- **WebGL 3D Logo** — GPU-accelerated particle simulation using Three.js and custom GLSL shaders
- **GSAP + ScrollTrigger** — Smooth scroll-driven animations throughout
- **Custom Web Components** — `<c-logo>`, `<c-shuffle-chars>`, and other interactive elements
- **Vite-bundled CSS + JS** — Compiled production assets with module preloading
- **Fully static HTML** — No server-side rendering, no framework dependencies at runtime

## Project Structure

```
.
├── index.html              # Home page
├── about/                  # About page
├── works/                  # Works listing page
├── work/                   # Individual work case studies
│   ├── anna-maria-rieder/
│   ├── casino/
│   ├── nachtschicht/
│   └── ...
├── legals/                 # Legal / imprint page
├── wp-content/
│   └── themes/gl/
│       ├── public/build/   # Compiled CSS + JS bundles (Vite output)
│       └── resources/js/GL # WebGL source — Three.js, GLSL shaders, DRACO
└── robots.txt
```

## WebGL System

The 3D logo animation uses a custom GPU particle simulation built on Three.js:

- **GPGPU particles** — Position computed on GPU via `GPUComputationRenderer`
- **DRACO decoder** — Compressed `.glb` model loading
- **Post-processing** — Custom `EffectComposer` pipeline with shader passes
- **ASCII render mode** — Optional ASCII character rendering mode
- **Mobile detection** — WebGL gracefully disabled on mobile

Source files live in `wp-content/themes/gl/resources/js/GL/`.

## Media Assets

Video and image uploads are excluded from this repository (see `.gitignore`).

The site references media from `wp-content/uploads/` — host these via CDN or local storage when serving the site.

## Running Locally

This is a fully static site — serve it from any HTTP server:

```bash
# Python (no dependencies)
python3 -m http.server 8080

# Node.js
npx serve .
```

Note: WebGL requires serving over HTTP (not `file://`) due to browser security restrictions on `fetch()`.

## Credits

Engineered by **[Profexor](mailto:profexor@atomicmail.io)** — Victoria, Australia.

---

> This repository is a technical showcase. All brand assets, media content, and creative work belong to their respective owners.
