import { Scene, TextureLoader, ImageBitmapLoader, CanvasTexture, NearestFilter } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Camera from './Camera'
import Renderer from './Renderer'
import store from '@scripts/util/store'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import Artefakt from './utils/Artefakt'
import Resources from './Resources'
import PlanesManager from './utils/PlanesManager'
import Noise from './utils/Noise'

let instance = null

export default class GL {
  constructor() {
    if (instance) return instance

    // eslint-disable-next-line consistent-this
    instance = this
    store.GL = this
    window.GL = this

    this.update = this.update.bind(this)

    gsap.registerPlugin(ScrollTrigger)
    store.scrollTrigger = ScrollTrigger

    this.sources = null
    this.cache = {}
    store.showDebug = window.location.hash === '#debug' && document.body.classList.contains('has-debug')

    this.createCanvas()
    this.createLoaders()

    this.scene = new Scene()
    this.scene.name = 'mainScene'

    this.camera = new Camera('perspective')

    this.renderer = new Renderer()

    this.resources = new Resources()

    this.asciiChars = ' .:-=+*#%@4RT3F'
    this.createAsciiTexture()

    this.planesManager = new PlanesManager({
      ascii: this.ascii
    })
  }

  createCanvas() {
    this.canvas = document.createElement('canvas')
    this.canvas.id = 'gl'

    const app = document.getElementById('app')
    
    app.appendChild(this.canvas)
  }

  createLoaders() {
    this.textureLoader = new TextureLoader()
    this.imageBitmapLoader = new ImageBitmapLoader()
    this.imageBitmapLoader.setOptions({ imageOrientation: 'flipY' })
    this.gltfLoader = new GLTFLoader()
    this.dracoLoader = new DRACOLoader()

    this.dracoLoader.setDecoderPath(window.location.origin + '/wp-content/themes/gl/resources/js/GL/draco/')

    this.gltfLoader.setDRACOLoader(this.dracoLoader)
  }

  onResourceLoaded() {
    this.artefakt = new Artefakt()

    if (!store.isMobile) this.noise = new Noise()
  }

  createAsciiTexture() {
    this.asciiTexture && this.asciiTexture.dispose()

    const pixelSize = 13 // Character size in pixels
    const fontFamily = 'monospace'
    
    const CHAR_SIZE = pixelSize
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    canvas.width = CHAR_SIZE * this.asciiChars.length
    canvas.height = CHAR_SIZE
    
    ctx.fillStyle = 'black'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = 'white'
    ctx.font = `${CHAR_SIZE}px ${fontFamily}`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    
    this.asciiChars.split('').forEach((char, i) => {
      ctx.fillText(char, (i + 0.5) * CHAR_SIZE, CHAR_SIZE / 2)
    })
    
    this.asciiTexture = new CanvasTexture(canvas)

    this.asciiTexture.minFilter = NearestFilter
    this.asciiTexture.magFilter = NearestFilter

    this.ascii = {
      texture: this.asciiTexture,
      chars: this.asciiChars,
      pixelSize: CHAR_SIZE
    }
  }

  getPlane(name) {
    return this.planesManager.els.find((el) => el.plane.name === name)
  }

  resize() {
    this.renderer.resize()
    this.camera.resize()
    this.artefakt && this.artefakt.resize()
    this.planesManager && this.planesManager.resize()
    this.noise && this.noise.resize()
  }

  screenChange(isMobile) {
    this.planesManager && this.planesManager.screenChange()

    if (isMobile) {
      this.noise && this.noise.destroy()
      this.noise = null
    } else {
      if (!this.noise) this.noise = new Noise()
    }
  }

  update() {
    this.camera.update()

    this.planesManager && this.planesManager.update()
    this.noise && this.noise.update()

    store.worksPlanes && store.worksPlanes.forEach((plane) => plane.update())

    if (store.renderToBuffer) return

    this.renderer.update()
  }

  destroy() {}
}
