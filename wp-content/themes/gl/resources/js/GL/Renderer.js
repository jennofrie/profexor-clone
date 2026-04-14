import { NoToneMapping, WebGLRenderer } from 'three'
import store from '@scripts/util/store'

export default class Renderer {
  constructor() {
    this.gl = store.GL
    this.canvas = this.gl.canvas
    this.scene = this.gl.scene
    this.camera = this.gl.camera

    this.setInstance()
  }

  setInstance() {
    this.instance = new WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: !store.isMobile,
      stencil: false,
      depth: false
    })

    this.instance.toneMapping = NoToneMapping

    this.instance.setSize(store.w.w, store.w.h)
    this.instance.setPixelRatio(store.w.pR)
  }

  resize() {
    this.instance.setSize(store.w.w, store.w.h)
    this.instance.setPixelRatio(store.w.pR)
  }

  update() {
    if (store.renderToBuffer) return

    this.instance.render(this.scene, this.camera.instance)
  }
}
