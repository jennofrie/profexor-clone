import store from '@scripts/util/store'
import { Vector2, Mesh, PlaneGeometry, ShaderMaterial } from 'three'
import fragmentShader from '@scripts/GL/shaders/noise/noise.frag'
import vertexShader from '@scripts/GL/shaders/noise/noise.vert'

export default class Noise {
  constructor() {
    this.gl = store.GL
    this.scene = this.gl.scene
    this.lastTime = performance.now()

    this.createMesh()
  }

  _asciiPixelSize() {
    const pixelScale = store.isMobile ? 100 : 180
    return store.w.w / pixelScale
  }

  createMesh() {
    const ascii = this.gl.ascii
    const geometry = new PlaneGeometry(1, 1, 1, 1)
    const material = new ShaderMaterial({
      fragmentShader,
      vertexShader,
      transparent: true,
      depthTest: false,
      uniforms: {
        uFlickerSpeed: { value: 8.5 },
        uBlackIntensity: { value: 0.5 },
        uProgress: { value: 1 },
        uTime: { value: 0 },
        uScale: { value: 29 },
        uOpacity: { value: 1 },
        uDensity: { value: 0.001 },
        uSpeed: { value: 0.3 },
        uMin: { value: 0.1 },
        uMax: { value: 1.1 },
        uScrollY: { value: 0 },
        uResolution: { value: new Vector2(store.w.w, store.w.h) },
        uAsciiTexture: { value: ascii.texture },
        uCharCount: { value: new Vector2(ascii.chars.length, 1) },
        uAsciiPixelSize: { value: this._asciiPixelSize() }
      }
    })

    this.mesh = new Mesh(geometry, material)
    this.mesh.name = 'Noise'
    this.mesh.depthTest = false
    this.mesh.depthWrite = false
    this.mesh.renderOrder = -1
    this.mesh.scale.set(store.w.w, store.w.h, 1)
    this.mesh.layers.set(0)

    this.scene.add(this.mesh)
  }

  resize() {
    this.mesh.scale.set(store.w.w, store.w.h, 1)
    this.mesh.material.uniforms.uResolution.value.set(store.w.w, store.w.h)
    this.mesh.material.uniforms.uAsciiPixelSize.value = this._asciiPixelSize()
  }

  destroy() {
    this.scene.remove(this.mesh)
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
    this.folder && this.folder.dispose()
  }

  update() {
    const now = performance.now()
    const delta = now - this.lastTime

    this.lastTime = now

    this.mesh.material.uniforms.uTime.value += 0.01 * (delta / 16.667)
    this.mesh.material.uniforms.uScrollY.value = store.smoothScroll.animatedScroll
  }
}
