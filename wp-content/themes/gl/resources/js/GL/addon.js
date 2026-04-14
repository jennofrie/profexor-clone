const codeData = {
  '../Site.js': {
    'import-gl': "import GL from './GL/GL'",
    'init-gl': 'if (!store.detect.isMobile) this.GL = new GL()',
    'resize-gl': 'this.GL && this.GL.resize()',
    'begin-fps': 'store.showDebug && store.GL && store.GL.debug.fpsGraph.begin()',
    'update-gl': 'this.GL && this.GL.update()',
    'end-fps': 'store.showDebug && store.GL && store.GL.debug.fpsGraph.end()'
  }
}

export default codeData
