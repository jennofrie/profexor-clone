import store from '../../util/store'
import MediaPlane from './MediaPlane'

/**
 * Manage all Planes at the same place.
 * 
 * In the Page.js file :
 * 
 * Add 'store.GL && store.GL.planesManager && store.GL.planesManager.init(this.content)' in the initBlocks() function.
 * Add 'store.GL && store.GL.planesManager.destroy()' in the onLeaveCompleted() function.
 */
export default class PlanesManager {
  constructor({ ascii }) {
    this.gl = store.GL
    this.els = []
    this.ascii = ascii

    !store.isMobile && this.init()
  }

  init(page = document) {    
    this.page = page
    this.els = []
    this.$els = this.page.querySelectorAll('.plane')

    for (let i = 0; i < this.$els.length; i++) {
      const dom = this.$els[i]

      this.els.push({
        dom,
        plane: new MediaPlane({
          dom,
          ascii: this.ascii
        })
      })
    }
  }

  appear() {
    this.els.forEach((el) => {
      el.plane?.appear()
    })
  }

  screenChange() {
    if (store.isMobile) this.destroy()
    else this.init()
  }

  resize() {
    for (let i = 0; i < this.els.length; i++) {
      this.els[i].plane.resize()
    }
  }

  destroy() {
    for (let i = 0; i < this.els.length; i++) {
      this.els[i].plane.destroy()
    }
  }

  update() {
    for (let i = 0; i < this.els.length; i++) {
      this.els[i].plane.update()
    }
  }
}
