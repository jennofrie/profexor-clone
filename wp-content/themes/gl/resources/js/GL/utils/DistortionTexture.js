import { DataTexture, RGBAFormat, FloatType, NearestFilter } from 'three'
import store from '@scripts/util/store'

export default class DistortionTexture {
  constructor({ dom = null, settings = {}, externalTracking = false }) {
    this.dom = dom
    this.externalTracking = externalTracking

    this.settings = {
      grid: 30,
      mouse: 4,
      strength: 0.08,
      relaxation: 0.85,
      ...settings
    }

    this.mouse = {
      current: { x: 0, y: 0 },
      prev: { x: 0, y: 0 }
    }

    this.dataTexture = null
    this.rect = null
    this._isActive = false

    this.cacheRect()

    if (!this.externalTracking) {
      this.onMove = this.onMove.bind(this)
      store.emitter.on('mousemove', this.onMove)
    }

    this.createTexture()
  }

  get texture() {
    return this.dataTexture
  }

  cacheRect() {
    if (this.dom) {
      const r = this.dom.getBoundingClientRect()
      
      this.rect = {
        left: r.left,
        top: r.top + window.scrollY,
        width: r.width,
        height: r.height
      }
    } else {
      this.rect = {
        left: 0,
        top: 0,
        width: window.innerWidth,
        height: window.innerHeight
      }
    }
  }

  track(x, y) {
    this.mouse.prev.x = x - this.mouse.current.x
    this.mouse.prev.y = y - this.mouse.current.y
    this.mouse.current.x = x
    this.mouse.current.y = y
    if (this.mouse.prev.x !== 0 || this.mouse.prev.y !== 0) this._isActive = true
  }

  onMove(e) {
    if (store.isMobile) return

    const x = (e.clientX - this.rect.left) / this.rect.width
    const y = (e.clientY + window.scrollY - this.rect.top) / this.rect.height

    this.track(x, y)
  }

  createTexture() {
    const r = this.rect
    let cellSize = this.settings.grid
    
    if (this.settings.cells) {
      cellSize = Math.max(r.width, r.height) / this.settings.cells
    }

    this.gridWidth = Math.max(1, Math.ceil(r.width / cellSize))
    this.gridHeight = Math.max(1, Math.ceil(r.height / cellSize))

    const size = this.gridWidth * this.gridHeight
    const data = new Float32Array(4 * size)

    if (this.dataTexture) this.dataTexture.dispose()

    this.dataTexture = new DataTexture(data, this.gridWidth, this.gridHeight, RGBAFormat, FloatType)
    this.dataTexture.magFilter = NearestFilter
    this.dataTexture.minFilter = NearestFilter
    this.dataTexture.needsUpdate = true
  }

  update() {
    if (store.isMobile || !this._isActive) return

    const data = this.dataTexture.image.data
    let maxVal = 0

    for (let i = 0; i < data.length; i += 4) {
      data[i] *= this.settings.relaxation
      data[i + 1] *= this.settings.relaxation
      if (Math.abs(data[i]) > maxVal) maxVal = Math.abs(data[i])
      if (Math.abs(data[i + 1]) > maxVal) maxVal = Math.abs(data[i + 1])
    }

    const gridMouseX = this.gridWidth * this.mouse.current.x
    const gridMouseY = this.gridHeight * (1 - this.mouse.current.y)
    const maxDist = this.settings.mouse
    const aspect = this.gridHeight / this.gridWidth

    for (let i = 0; i < this.gridWidth; i++) {
      for (let j = 0; j < this.gridHeight; j++) {
        const distance = (gridMouseX - i) ** 2 / aspect + (gridMouseY - j) ** 2
        const maxDistSq = maxDist ** 2

        if (distance < maxDistSq) {
          const index = 4 * (i + this.gridWidth * j)

          let power = maxDist / Math.sqrt(distance)
          power = Math.min(power, 10)

          data[index] += this.settings.strength * 100 * this.mouse.prev.x * power
          data[index + 1] -= this.settings.strength * 100 * this.mouse.prev.y * power

          if (Math.abs(data[index]) > maxVal) maxVal = Math.abs(data[index])
          if (Math.abs(data[index + 1]) > maxVal) maxVal = Math.abs(data[index + 1])
        }
      }
    }

    this.mouse.prev.x = 0
    this.mouse.prev.y = 0

    this._isActive = maxVal > 0.001
    this.dataTexture.needsUpdate = true
  }

  resize() {
    this.cacheRect()
    this.createTexture()
  }

  destroy() {
    if (!this.externalTracking) {
      store.emitter.off('mousemove', this.onMove)
    }

    if (this.dataTexture) {
      this.dataTexture.dispose()
      this.dataTexture = null
    }
  }
}
