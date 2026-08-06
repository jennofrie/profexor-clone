import fs from 'node:fs/promises'
import path from 'node:path'
import { createFont, woff2 } from 'fonteditor-core'
import opentype from 'opentype.js'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { createRemeshedTextGeometry, inspectGeometry, assertGeometryMatchesConfig } from './geometry.mjs'
import { fontFile, modelConfigs, sourceDirectory } from './model-config.mjs'

class NodeFileReader {
  constructor() {
    this.result = null
    this.onloadend = null
    this.onerror = null
  }

  async readAsArrayBuffer(blob) {
    try {
      this.result = await blob.arrayBuffer()
      this.onloadend?.()
    } catch (error) {
      this.onerror?.(error)
      throw error
    }
  }
}

globalThis.FileReader = NodeFileReader

async function loadFont() {
  await woff2.init()

  const woff2Buffer = await fs.readFile(fontFile)
  const fontSource = createFont(woff2Buffer, { type: 'woff2' })
  const ttfBuffer = Buffer.from(fontSource.write({ type: 'ttf' }))
  const arrayBuffer = ttfBuffer.buffer.slice(
    ttfBuffer.byteOffset,
    ttfBuffer.byteOffset + ttfBuffer.byteLength
  )

  return opentype.parse(arrayBuffer)
}

async function exportGeometry(geometry, config) {
  const scene = new THREE.Scene()
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 1,
    side: THREE.FrontSide
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = config.meshName
  scene.add(mesh)

  const exporter = new GLTFExporter()
  const arrayBuffer = await exporter.parseAsync(scene, {
    binary: true,
    onlyVisible: true,
    trs: false
  })
  const outputFile = path.join(sourceDirectory, config.file)

  await fs.writeFile(outputFile, Buffer.from(arrayBuffer))
  material.dispose()

  return outputFile
}

async function main() {
  const font = await loadFont()
  await fs.mkdir(sourceDirectory, { recursive: true })

  for (const config of modelConfigs) {
    const geometry = createRemeshedTextGeometry(font, config)
    const stats = inspectGeometry(geometry)
    assertGeometryMatchesConfig(stats, config)

    const outputFile = await exportGeometry(geometry, config)
    geometry.dispose()

    const fileStats = await fs.stat(outputFile)
    console.log(JSON.stringify({
      role: config.role,
      file: path.relative(sourceDirectory, outputFile),
      bytes: fileStats.size,
      ...stats
    }))
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
