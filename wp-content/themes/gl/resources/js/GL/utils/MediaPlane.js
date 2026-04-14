import { PlaneGeometry, Mesh, ShaderMaterial, Vector2, LinearFilter, VideoTexture } from 'three'
import store from '@scripts/util/store'
import vertexShader from '../shaders/media-plane/media-plane.vert'
import fragmentShader from '../shaders/media-plane/media-plane.frag'
import gsap from 'gsap'
import DistortionTexture from './DistortionTexture'

const DEBUG = false

const log = (msg, url, fromCache) => {
  if (!DEBUG) return

  const style = fromCache
    ? 'background: #22c55e; color: #fff; padding: 2px 6px; border-radius: 3px;'
    : 'background: #f97316; color: #fff; padding: 2px 6px; border-radius: 3px;'

  console.log(`%c${msg}`, style, url)
}

export default class MediaPlane {
  constructor({ dom, ascii, gui, renderInViewport = true, enableTrigger = true, visible = true }) {
    this.dom = dom
    this.gl = store.GL
    this.ascii = ascii
    this.gui = gui
    this.renderInViewport = renderInViewport
    this.enableTrigger = enableTrigger
    this.visible = visible

    // Array of 2 textures: default and secondary texture
    this.assets = [
      {
        dom: null,
        type: null,
        media: null,
        texture: null,
        uniform: 'uTexture'
      },
      {
        dom: null,
        type: null,
        media: null,
        texture: null,
        uniform: 'uTexture2'
      }
    ]

    this.textures = []
    this._pending = new Map()

    this.isLoaded = false
    this.canScroll = false
    this.initialScrollY = window.scrollY
    this.stickyOffset = 0

    this.mode = this.dom.dataset.mode ? Number(this.dom.dataset.mode) : 0
    this.image = this.dom.dataset.image
    this.video = this.dom.dataset.video
    this.name = this.dom.dataset.name || null
    this.enableHover = this.dom.dataset.enableHover || false
    this.parent = this.dom.parentElement.parentElement
    this.disablePixel = this.dom.dataset.disablePixel || false

    this.isSticky = this.dom.dataset.sticky

    if (this.mode === 0) {
      this.pixels = [0.01, 7, 7.5, 8, 8.5, 9, 9.5, 10, 30, 50, 100]
    } else {
      this.pixels = [0.01, 5, 10, 25, 30, 35, 40, 45, 50, 55, 60]
    }
    
    this.bindMethods()
    this.createMesh()
    this.setData()

    this.distortion = new DistortionTexture({
      dom: this.dom,
      settings: { grid: 13, mouse: 10, strength: 0.08, relaxation: 0.85 },
      externalTracking: true
    })

    this.material.uniforms.uDataTexture.value = this.distortion.texture

    store.emitter.on('mousemove', this.onMove)

    // video takes priority; if both exist the image is used as a placeholder (see _triggerLoad)
    this.assets[0].type = this.dom.dataset.video ? 'video' : 'image'

    if (this.dom.dataset.video) {
      this.assets[0].media = this.dom.dataset.video
    } else if (this.dom.dataset.image) {
      this.assets[0].media = this.dom.dataset.image
    }

    this.isInView = store.scrollTrigger.isInViewport(this.dom)
    this.mesh.visible = this.isInView

    this.initLoadTrigger()
    this.initTrigger()

    this.isSticky && this.initStickyTrigger()
  }

  bindMethods() {
    this.onMove = this.onMove.bind(this)
  }

  appear() {
    this.mode === 0 && this.enableTrigger && this.initRevealTrigger()
  }

  initLoadTrigger() {
    this.loadST && this.loadST.kill()
    this.loadST = null

    if (this.isLoaded || this._isLoading) return

    if (this.isInView) {
      this._triggerLoad()
    } else {
      this.loadST = store.scrollTrigger.create({
        trigger: this.dom,
        start: 'top 200%',
        once: true,
        onEnter: () => this._triggerLoad()
      })
    }
  }

  _triggerLoad() {
    this._isLoading = true

    const done = () => {
      this._isLoading = false
      this.canScroll = true
    }

    if (this.video && this.image) {
      // Load the image first so the plane is visible immediately, then replace
      // uTexture with the video once it has buffered enough to play.
      // Use explicit index=0 so _triggerLoad never conflicts with addTexture(media, N)
      // calls from outside (e.g. Works.js preloading card[1] at index 1).
      const imageAsset = { type: 'image', media: this.image, uniform: 'uTexture' }

      this.load(imageAsset, true, 0).then(() => {
        this.canScroll = true
        return this.load(this.assets[0], true, 0)
      }).then(() => {
        // Dispose the placeholder image texture — video has taken over textures[0].
        // The video entry now lives at index 0, so the image entry is already gone;
        // we only need to clean up the GPU/cache side.
        const cached = store.textureCache.get(this.image)

        if (cached?.tex) {
          cached.tex.dispose()
          store.textureCache.delete(this.image)
        }

        done()

        // Load secondary asset only after primary is done to avoid competing for bandwidth/GPU
        this.addAsset(this.dom.dataset.video2)
      })
    } else {
      this.load(this.assets[0], true, 0).then(() => {
        done()
        this.addAsset(this.dom.dataset.video2)
      })
    }
  }

  addAsset(media) {
    if (!media) return

    const type = media.includes('.mp4') ? 'video' : 'image'

    this.assets[1].type = type
    this.assets[1].media = media

    this.load(this.assets[1]).then(() => {
      this.isInView && this.assets[1].dom?.play()
    })
  }

  addTexture(media, index, uniform = 'uTexture') {
    if (this.textures[index]) {
      const p = Promise.resolve(this.textures[index])
      p.video = null
      return p
    }

    if (this._pending.has(index)) return this._pending.get(index)

    // Accept { image, video } object or a plain string (legacy / image-only / video-only)
    const imageUrl = typeof media === 'object' ? media.image : (media?.includes('.mp4') ? null : media)
    const videoUrl = typeof media === 'object' ? media.video : (media?.includes('.mp4') ? media : null)

    // Separate promise for the video stage so callers can react exactly when video is ready,
    // without relying on a scroll re-trigger or polling textures[index].
    let resolveVideo = null
    const videoPromise = videoUrl ? new Promise((r) => { resolveVideo = r }) : null

    const promise = new Promise((resolve) => {
      if (imageUrl) {
        // Stage 1 — image loads fast, resolve so the plane shows something immediately
        this.load({ type: 'image', media: imageUrl, uniform }, false, index).then(() => {
          resolve(this.textures[index])

          if (videoUrl) {
            // Stage 2 — video loads in the background, overwrites the slot when ready
            this.load({ type: 'video', media: videoUrl, uniform }, false, index).then(() => {
              const cached = store.textureCache.get(imageUrl)

              if (cached?.tex) {
                cached.tex.dispose()
                store.textureCache.delete(imageUrl)
              }

              resolveVideo(this.textures[index])
            })
          }
        })
      } else if (videoUrl) {
        this.load({ type: 'video', media: videoUrl, uniform }, false, index).then(() => {
          resolve(this.textures[index])
        })
      } else {
        resolve(null)
      }
    })

    promise.video = videoPromise
    this._pending.set(index, promise)
    promise.then(() => this._pending.delete(index))

    return promise
  }

  load(asset, set = true, index = null) {
    if (asset.type === 'video') {
      return this.loadVideo(asset, set, index)
    }

    if (asset.type === 'image') {
      return this.loadTexture(asset, set, index)
    }

    return Promise.resolve()
  }

  loadTexture(asset, set = true, index = null) {
    return new Promise((resolve) => {
      const cached = store.textureCache.get(asset.media)

      if (cached) {
        log('Image from cache', asset.media, true)

        if (set) {
          this.mesh.material.uniforms[asset.uniform].value = cached.tex
          const sizeUniform = asset.uniform === 'uTexture' ? 'uImageSize' : 'uImageSize2'
          this.mesh.material.uniforms[sizeUniform].value = new Vector2(cached.size.w, cached.size.h)
        }

        const entry = { tex: cached.tex, size: new Vector2(cached.size.w, cached.size.h), uniform: asset.uniform, url: asset.media }
        index !== null ? (this.textures[index] = entry) : this.textures.push(entry)
        this.isLoaded = true
        resolve()
        return
      }

      // TextureLoader — main-thread decode
      this.gl.textureLoader.load(asset.media, (tex) => {
        tex.minFilter = LinearFilter
        tex.magFilter = LinearFilter
        tex.generateMipmaps = false

        const size = { w: tex.source.data.naturalWidth, h: tex.source.data.naturalHeight }
        store.textureCache.set(asset.media, { tex, size })
        log('Image loaded', asset.media, false)

        // Pre-upload to GPU — prevents hitch on first render
        this.gl.renderer.instance.initTexture(tex)

        if (set) {
          this.mesh.material.uniforms[asset.uniform].value = tex
          const sizeUniform = asset.uniform === 'uTexture' ? 'uImageSize' : 'uImageSize2'
          this.mesh.material.uniforms[sizeUniform].value = new Vector2(size.w, size.h)
        }

        const entry = { tex, size: new Vector2(size.w, size.h), uniform: asset.uniform, url: asset.media }
        index !== null ? (this.textures[index] = entry) : this.textures.push(entry)
        this.isLoaded = true
        resolve()
      })

      // ImageBitmapLoader — decodes off main thread (disabled: may cause visibility issues)
      // this.gl.imageBitmapLoader.load(asset.media, (bitmap) => {
      //   const tex = new Texture(bitmap)
      //   tex.minFilter = LinearFilter
      //   tex.magFilter = LinearFilter
      //   tex.generateMipmaps = false
      //   tex.needsUpdate = true

      //   const size = { w: bitmap.width, h: bitmap.height }
      //   store.textureCache.set(asset.media, { tex, size })
      //   log('Image loaded', asset.media, false)

      //   // Pre-upload to GPU — prevents hitch on first render
      //   this.gl.renderer.instance.initTexture(tex)

      //   if (set) {
      //     this.mesh.material.uniforms[asset.uniform].value = tex
      //     const sizeUniform = asset.uniform === 'uTexture' ? 'uImageSize' : 'uImageSize2'
      //     this.mesh.material.uniforms[sizeUniform].value = new Vector2(size.w, size.h)
      //   }

      //   const entry = { tex, size: new Vector2(size.w, size.h), uniform: asset.uniform, url: asset.media }
      //   index !== null ? (this.textures[index] = entry) : this.textures.push(entry)
      //   this.isLoaded = true
      //   resolve()
      // })
    })
  }

  loadVideo(asset, set = true, index = null) {
    return new Promise((resolve) => {
      const cached = store.textureCache.get(asset.media)

      // Always create a fresh video element per plane. Sharing a single $video element
      // between multiple VideoTexture instances causes shared playback state — play/pause
      // on one plane affects all others using the same element.
      // The browser HTTP cache handles network deduplication; we only cache the size
      // metadata to avoid re-reading videoWidth/videoHeight on subsequent planes.
      const $video = document.createElement('video')

      $video.muted = true
      $video.playsInline = true
      $video.loop = true
      asset.dom = $video

      $video.onloadeddata = () => {
        const size = cached?.size ?? { w: $video.videoWidth, h: $video.videoHeight }

        if (cached) {
          log('Video from cache (new element)', asset.media, true)
        } else {
          // Only store size metadata — not the video element itself
          store.textureCache.set(asset.media, { size })
          log('Video loaded', asset.media, false)
        }

        const texture = new VideoTexture($video)
        texture.minFilter = LinearFilter
        texture.magFilter = LinearFilter
        texture.generateMipmaps = false
        // Force the current frame onto the GPU immediately.
        // VideoTexture uses requestVideoFrameCallback in modern browsers, which only fires
        // when a new frame is presented — a paused video never triggers it,
        // leaving the texture blank until playback starts.
        texture.needsUpdate = true

        asset.texture = texture

        if (set) {
          this.mesh.material.uniforms[asset.uniform].value = texture
          const sizeUniform = asset.uniform === 'uTexture' ? 'uImageSize' : 'uImageSize2'
          this.mesh.material.uniforms[sizeUniform].value = new Vector2(size.w, size.h)
        }

        if (this.isInView && $video.paused) {
          $video.play()
        }

        const entry = { dom: $video, uniform: asset.uniform, tex: texture, size: new Vector2(size.w, size.h) }
        index !== null ? (this.textures[index] = entry) : this.textures.push(entry)
        this.isLoaded = true
        resolve()
      }

      $video.src = asset.media
      $video.load()
    })
  }

  initRevealTrigger() {
    const animation = gsap.timeline({
      onStart: () => {
        this.mesh.visible = true
      }
    })

    animation
      .to(this.mesh.material.uniforms.uProgress, {
        value: 1,
        ease: 'none'
      })

    this.revealST = store.scrollTrigger.create({
      trigger: this.dom,
      scrub: true,
      start: 'top 90%',
      end: 'bottom 95%',
      animation
    })
  }

  initStickyTrigger() {
    this.stickyST && this.stickyST.kill()

    if (store.isMobile) return

    this.stickyValue = this.parent.getBoundingClientRect().height - this.bounds.dom.height

    this.stickyST = store.scrollTrigger.create({
      trigger: this.parent,
      start: 'top top',
      end: 'bottom bottom',
      onEnter: () => {
        this.canScroll = false
        this.mesh.position.y = this.bounds.gl.y + this.bounds.parent.top + this.initialScrollY
      },
      onEnterBack: () => {
        this.canScroll = false
        this.stickyOffset = 0
        this.mesh.position.y = this.bounds.gl.y + this.bounds.parent.top + this.initialScrollY
      },
      onUpdate: (e) => {
        this.stickyOffset = this.stickyValue * e.progress
      },
      onLeave: () => {
        this.canScroll = true
      },
      onLeaveBack: () => {
        this.stickyOffset = 0
        this.canScroll = true
      }
    })
  }

  initTrigger() {
    this.sT = store.scrollTrigger.create({
      trigger: this.parent || this.dom,
      onEnter: () => {
        this.onEnterView()
        this.assets[0].type === 'video' && this.assets[0].dom?.play()
      },
      onEnterBack: () => {
        this.onEnterView()
        this.assets[0].type === 'video' && this.assets[0].dom?.play()
      },
      onLeave: () => {
        this.onLeaveView()
        this.assets[0].type === 'video' && this.assets[0].dom?.pause()
      },
      onLeaveBack: () => {
        this.onLeaveView()
        this.assets[0].type === 'video' && this.assets[0].dom?.pause()
      }
    })
  }

  animate() {
    return gsap.to(this.mesh.material.uniforms.uProgress, {
      value: 1,
      duration: 2,
      ease: 'gl.fastInOut'
    })
  }

  onEnterView() {
    this.isInView = true
    this.mesh.visible = true
  }

  onLeaveView() {
    this.isInView = false
    this.mesh.visible = false
  }

  createMesh() {
    const r = this.dom.getBoundingClientRect()

    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      uniforms: {
        uPixels: { value: this.pixels },
        uPixelsLength: { value: this.pixels.length - 1 },
        uTime: { value: 0 },
        uTexture: { value: '' },
        uTexture2: { value: '' },
        uResolution: { value: new Vector2(store.w.w, store.w.h) },
        uImageSize: { value: new Vector2(0, 0) },
        uImageSize2: { value: new Vector2(0, 0) },
        uMeshSize: { value: new Vector2(r.width, r.height)},
        uProgress: { value: 0 },
        uAsciiTexture: { value: this.ascii?.texture },
        uCharCount: { value: new Vector2(this.ascii?.chars.length, 1) },
        uPixelSize: { value: this.ascii?.pixelSize },
        uAsciiPixelSize: { value: 13 },
        uRevealDelay: { value: 0.1 },
        uRevealHeight: { value: 0.3 },
        uBlueWhiteMode: { value: false },
        uShowAsciiOnly: { value: false },
        uPixelationEnabled: { value: false },
        uPixelationEnabled2: { value: false },
        uMode: { value: this.mode },
        uAlpha: { value: this.visible ? 1 : 0 },
        uDataTexture: { value: null },
        uDisablePixel: { value: this.disablePixel ? 0 : 1 }
      }
    })

    this.geometry = new PlaneGeometry(1, 1, 1, 1)
    this.mesh = new Mesh(this.geometry, this.material)

    this.mesh.layers.set(0)

    this.gl.scene.add(this.mesh)
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

    if (this.parent) {
      this.bounds.parent = this.parent.getBoundingClientRect()
    }

    return this.bounds
  }

  setData() {
    this.getBounds()

    this.mesh.material.uniforms.uMeshSize.value = new Vector2(this.bounds.dom.width, this.bounds.dom.height)
    this.mesh.position.set(this.bounds.gl.x, this.bounds.gl.y, 0)
    this.mesh.scale.set(this.bounds.dom.width, this.bounds.dom.height, 1)
  }

  onMove(e) {
    const t = this.isSticky ? this.bounds.parent.top - this.bounds.dom.top : 0
    const scrollY = store.smoothScroll ? store.smoothScroll.animatedScroll : window.scrollY
    const point = {
      x: gsap.utils.mapRange(this.bounds.dom.left, this.bounds.dom.right, 0, 1, e.clientX),
      y: gsap.utils.mapRange(this.bounds.dom.top, this.bounds.dom.bottom, 0, 1, e.clientY - t + scrollY - this.initialScrollY - this.stickyOffset)
    }

    this.distortion.track(point.x, point.y)
  }

  resize() {
    this.initialScrollY = window.scrollY

    this.setData()
    this.distortion.resize()
    this.material.uniforms.uDataTexture.value = this.distortion.texture
    this.isSticky && this.initStickyTrigger()
    this.initLoadTrigger()
  }

  destroy() {
    store.emitter.off('mousemove', this.onMove)
    this.distortion.destroy()

    this.loadST && this.loadST.kill()
    this.revealST && this.revealST.kill()
    this.sT && this.sT.kill()

    this.folder && this.folder.dispose()

    this.textures.forEach((t) => {
      if (t.dom) {
        // VideoTexture is a per-plane wrapper — safe to dispose
        t.tex?.dispose()
        t.dom.pause()
        t.dom.src = ''   // abort the download
        t.dom.load()
      } else {
        // Dispose image texture and remove from cache
        t.tex?.dispose()
        t.url && store.textureCache.delete(t.url)
      }
    })
    this.textures.length = 0

    this.material.dispose()
    this.geometry.dispose()
    this.gl.scene.remove(this.mesh)
  }

  update() {
    if (this.isInView) {
      this.distortion.update()
    }

    // console.log('update', this.canScroll, this.isInView, this.dom)
    
    if (this.isInView && this.canScroll) {
      // console.log('update scroll', this.mesh.position.y);
      
      this.mesh.position.y = this.bounds.gl.y + store.smoothScroll.animatedScroll - this.stickyOffset
    }

    if (this.isInView) this.mesh.material.uniforms.uTime.value += 0.01
  }
}
