import { LinearFilter } from 'three'
import store from '@scripts/util/store'

export default class Resources {
  constructor() {
    this.gl = store.GL
    this.path = window.location.origin + '/wp-content/themes/gl/resources/js/GL/sources/'
    this.loaded = 0
    this.sources = {}

    this.toLoad = [
      {
        name: 'logo',
        file: 'artefakt.glb',
        loader: 'gltfLoader'
      },
      {
        name: 'logoLowPoly',
        file: 'artefakt-low-poly.glb',
        loader: 'gltfLoader'
      }
    ]

    this.gltfLoader = store.GL.gltfLoader
    this.textureLoader = store.GL.textureLoader
  }

  load() {
    return this._loadSources(this.toLoad)
  }

  /**
   * Load additional models on demand (called by blocks on mount).
   * Already-loaded sources are skipped, so re-navigating to the same
   * page never re-fetches anything.
   */
  loadMore(sources) {
    const pending = sources.filter(({ name }) => !this.sources[name])

    if (!pending.length) return Promise.resolve()

    return this._loadSources(pending)
  }

  _loadSources(list) {
    return new Promise((resolve) => {
      let done = 0

      for (let i = 0; i < list.length; i++) {
        const { name, file, loader } = list[i]

        if (loader === 'gltfLoader') {
          this.gltfLoader.load(this.path + file, (object) => {
            this.sources[name] = object

            ++done === list.length && resolve()
          })
        } else if (loader === 'textureLoader') {
          this.textureLoader.load(this.path + file, (texture) => {
            texture.minFilter = LinearFilter
            texture.magFilter = LinearFilter
            texture.generateMipmaps = false

            this.sources[name] = {
              texture,
              width: texture.source.data.naturalWidth,
              height: texture.source.data.naturalHeight
            }

            ++done === list.length && resolve()
          })
        }
      }
    })
  }
}
