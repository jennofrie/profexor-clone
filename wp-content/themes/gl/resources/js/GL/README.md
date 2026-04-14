# WebGL — GPU Particle System

Custom Three.js WebGL engine powering the interactive 3D logo animation.

## Architecture

```
GL/
├── GL.js               # Main WebGL class (singleton, canvas setup, loaders)
├── Renderer.js         # WebGL renderer configuration
├── utils/
│   ├── Artefakt.js     # 3D logo: GPGPU particle simulation + post-processing
│   ├── PlanesManager.js# Scroll-synced media planes
│   ├── MediaPlane.js   # Individual video/image plane with shader distortion
│   ├── Plane.js        # Base plane geometry
│   ├── DistortionTexture.js
│   └── Noise.js        # Background noise effect
├── shaders/
│   ├── artefakt/       # Vertex + fragment shaders for the 3D logo particles
│   ├── media-plane/    # Distortion shaders for scroll-driven media
│   ├── gpgpu/          # GPU computation shader (particle positions)
│   ├── plane/          # Base plane shaders
│   └── noise/          # Background noise shaders
├── sources/            # Compressed .glb 3D models (DRACO-encoded)
├── draco/              # DRACO decoder (WASM + JS)
└── init.js             # Build utility — injects shader source via addon.js
```

## Key Techniques

- **GPGPU simulation** — Particle positions computed per-frame on the GPU via `GPUComputationRenderer` and a custom flow-field shader
- **DRACO compression** — All `.glb` models are Draco-compressed for fast load
- **Post-processing pipeline** — `EffectComposer` with custom `ShaderPass` for ASCII and distortion effects
- **Mouse interaction** — Raycaster-based tracking drives real-time particle displacement
- **Scroll triggers** — GSAP `ScrollTrigger` coordinates WebGL state with page scroll position

## Models

| File | Description |
|------|-------------|
| `sources/artefakt.glb` | High-poly logo model |
| `sources/artefakt-low-poly.glb` | Low-poly collision mesh for raycasting |
| `sources/a.glb` | Alternate letter model |
| `sources/face-lowpoly.glb` | Face model (low-poly) |
| `sources/daniel.glb`, `jan.glb`, `lukas.glb` | Team member models |

## Dependencies

- [Three.js](https://threejs.org/) — WebGL renderer and 3D scene management
- [GSAP](https://gsap.com/) + ScrollTrigger — Animation and scroll synchronization
- [DRACO](https://google.github.io/draco/) — 3D mesh compression/decompression

## Build Note

The `init.js` script injects shader source code into GL files at build time via `addon.js`. This runs upstream as part of the Vite build pipeline — no manual rebuild is needed to use the compiled static site.
