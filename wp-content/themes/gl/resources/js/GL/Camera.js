import { PerspectiveCamera, OrthographicCamera } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import GL from './GL'
import store from '@scripts/util/store'

export default class Camera {
  constructor(type = 'perspective', scene) {
    this.type = type
    this.gl = new GL()
    this.scene = scene || this.gl.scene
    this.canvas = this.gl.canvas

    if (this.type === 'perspective') {
      this.setPerspective()
    } else {
      this.setOrthographic()
    }
  }

  setOrthographic() {
    const w = store.w.w
    const h = store.w.h

    this.instance = new OrthographicCamera(
      -w / 2,
      w / 2,
      h / 2,
      -h / 2,
      -1000,
      1000
    )

    this.instance.position.set(0, 0, 5)
    this.scene.add(this.instance)
  }

  setPerspective() {
    const { w, h } = store.w
    const fov = 45
    const perspective = h / 2 / Math.tan(fov * Math.PI / 360)

    this.instance = new PerspectiveCamera(
      fov,
      w / h,
      1,
      perspective + 4000
    )

    this.instance.position.set(0, 0, perspective)

    this.scene.add(this.instance)
  }

  setOrbitControls() {
    this.controls = new OrbitControls(this.instance, this.canvas)
    this.controls.enableDamping = true
    this.canvas.style.pointerEvents = 'all'
  }

  resize() {
    if (this.type === 'perspective') {
      const { w, h } = store.w
      const fov = 45
      const perspective = h / 2 / Math.tan(fov * Math.PI / 360)

      this.instance.aspect = w / h
      this.instance.far = perspective + 1000
      this.instance.position.set(0, 0, perspective)
    } else {
      const w = store.w.w
      const h = store.w.h

      this.instance.left = w / - 2
      this.instance.right = w / 2
      this.instance.top = h / 2
      this.instance.bottom = h / - 2
    }

    this.instance.updateProjectionMatrix()
  }

  update() {
    this.controls && this.controls.update()
  }
}
