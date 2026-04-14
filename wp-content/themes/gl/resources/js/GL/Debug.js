import { Pane } from 'tweakpane'
import * as EssentialsPlugin from '@tweakpane/plugin-essentials'
import store from '@scripts/util/store'

export default class Debug {
  constructor() {
    this.create()

    document.body.classList.add('debug')
  }

  create() {
    store.debug = new Pane({ title: 'GUI' })

    store.debug.registerPlugin(EssentialsPlugin)
    
    this.fpsGraph = store.debug.addBlade({
      view: 'fpsgraph',
      label: 'fpsgraph',
      lineCount: 2
    })
  }

  addDebugUI() {
    const button = store.debug.addButton({ title: 'Show debug UI 👀' })

    button.on('click', () => document.body.classList.toggle('debug'))
  }
}
