import { PlaneGeometry, Mesh, ShaderMaterial, Vector2, LinearFilter, /* VideoTexture, */ Texture } from 'three'
import store from '@scripts/util/store'
import vertexShader from '../shaders/plane/plane.vert'
import fragmentShader from '../shaders/plane/plane.frag'
import DistortionTexture from './DistortionTexture'

const DEBUG = false

const log = (msg, url, fromCache) => {
  if (!DEBUG) return

  const style = fromCache
    ? 'background: #22c55e; color: #fff; padding: 2px 6px; border-radius: 3px;'
    : 'background: #f97316; color: #fff; padding: 2px 6px; border-radius: 3px;'

  console.log(`%c${msg}`, style, url)
}

export default class Plane {
  constructor({ dom }) {
    this.dom = dom
    this.gl = store.GL

    this.isLoaded = false
    this.canScroll = false
    this.image = this.dom.dataset.image
    // this.videoLoop = this.dom.dataset.loop // disabled: playing 15 videos on close() causes GPU stall

    this.createMesh()
    this.setData()

    this.distortion = new DistortionTexture({
      settings: { grid: 13, mouse: 10, strength: 0.08, relaxation: 0.85 }
    })
    
    this.material.uniforms.uDataTexture.value = this.distortion.texture
  }

  load() {
    // Loop videos disabled — playing all 15 on close() causes a GPU stall / frame drop.
    // uLoopEnabled stays 0, so the shader just uses the image texture (uTexture).
    // if (this.videoLoop && !store.isMobile) {
    //   this.loadVideo()
    // }

    if (this.image) {
      return this.loadTexture()
    }

    return Promise.resolve()
  }

  loadTexture() {
    return new Promise((resolve) => {
      const cached = store.textureCache.get(this.image)

      if (cached) {
        log('Image from cache', this.image, true)

        this.mesh.material.uniforms.uTexture.value = cached.tex
        this.mesh.material.uniforms.uImageSize.value = new Vector2(cached.size.w, cached.size.h)

        requestAnimationFrame(() => { this.canScroll = true })
        this.isLoaded = true
        resolve()
        return
      }

      // ImageBitmapLoader — decodes off main thread, no jank on load
      this.gl.imageBitmapLoader.load(this.image, (bitmap) => {
        const tex = new Texture(bitmap)
        tex.minFilter = LinearFilter
        tex.magFilter = LinearFilter
        tex.generateMipmaps = false
        tex.needsUpdate = true

        const size = { w: bitmap.width, h: bitmap.height }
        store.textureCache.set(this.image, { tex, size })
        log('Image loaded', this.image, false)

        this.gl.renderer.instance.initTexture(tex)

        this.mesh.material.uniforms.uTexture.value = tex
        this.mesh.material.uniforms.uImageSize.value = new Vector2(size.w, size.h)

        requestAnimationFrame(() => { this.canScroll = true })
        this.isLoaded = true
        resolve()
      })
    })
  }

  createMesh() {
    const r = this.dom.getBoundingClientRect()

    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      uniforms: {
        uAlpha: { value: 1 },
        uReveal: { value: 0.9 },
        uScale: { value: 1.2 },
        uDarkness: { value: 0 },
        uTime: { value: 0 },
        uTexture: { value: '' },
        uVideoTexture: { value: '' },
        uLoopTexture: { value: '' },
        uVideoEnabled: { value: 0 },
        uParallax: { value: 0 },
        uResolution: { value: new Vector2(store.w.w, store.w.h) },
        uImageSize: { value: new Vector2(0, 0) },
        uVideoSize: { value: new Vector2(0, 0) },
        uLoopSize: { value: new Vector2(0, 0) },
        uMeshSize: { value: new Vector2(r.width, r.height)},
        uDataTexture: { value: null }
      }
    })

    this.geometry = new PlaneGeometry(1, 1, 1, 1)
    this.mesh = new Mesh(this.geometry, this.material)
    this.mesh.visible = false
  }

  getBounds() {
    const r = this.dom.getBoundingClientRect()
    const scroll = window.scrollY
    const top = r.top + window.scrollY - store.w.h
    const offset = Math.min(top, 0) + r.height + store.w.h
    const maxTop = Math.max(top, 0)

    this.bounds = {
      dom: r,
      gl: {
        top,
        bottom: offset + maxTop,
        x: r.left - store.w.w / 2 + r.width / 2,
        y: - r.top + store.w.h / 2 - r.height / 2 - scroll,
        w: r.width,
        h: r.height
      }
    }

    return this.bounds
  }

  setData() {
    this.getBounds()

    this.mesh.material.uniforms.uMeshSize.value = new Vector2(this.bounds.dom.width, this.bounds.dom.height)
    this.mesh.scale.set(this.bounds.dom.width, this.bounds.dom.height, 1)
  }

  resize() {
    this.setData()
    this.distortion.resize()
    this.material.uniforms.uDataTexture.value = this.distortion.texture
  }

  update() {
    this.distortion.update()
  }

  destroy() {
    this.distortion.destroy()
    // Image texture lives in the cache — do not dispose
    // this.material.uniforms.uLoopTexture.value?.dispose() // loop videos disabled
    // this.video?.pause() // loop videos disabled
    this.material.dispose()
    this.geometry.dispose()
    this.gl.scene.remove(this.mesh)
  }
}
