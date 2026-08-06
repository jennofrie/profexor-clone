import fs from 'node:fs/promises'
import path from 'node:path'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { assertGeometryMatchesConfig, inspectGeometry } from './geometry.mjs'
import { modelConfigs, sourceDirectory } from './model-config.mjs'

async function loadGlb(file) {
  const buffer = await fs.readFile(file)
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  )
  const loader = new GLTFLoader()

  return new Promise((resolve, reject) => {
    loader.parse(arrayBuffer, '', resolve, reject)
  })
}

function findMeshes(scene) {
  const meshes = []
  scene.traverse((object) => {
    if (object.isMesh) meshes.push(object)
  })
  return meshes
}

async function main() {
  const reports = []

  for (const config of modelConfigs) {
    const file = path.join(sourceDirectory, config.file)
    const fileStats = await fs.stat(file)

    if (fileStats.size > config.limits.maxBytes) {
      throw new Error(
        `${config.file} is ${fileStats.size} bytes; limit is ${config.limits.maxBytes}`
      )
    }

    const gltf = await loadGlb(file)
    const meshes = findMeshes(gltf.scene)

    if (meshes.length !== 1) {
      throw new Error(`${config.file} contains ${meshes.length} meshes; expected one`)
    }

    if (meshes[0].name !== config.meshName) {
      throw new Error(
        `${config.file} mesh is named ${meshes[0].name}; expected ${config.meshName}`
      )
    }

    const stats = inspectGeometry(meshes[0].geometry)
    assertGeometryMatchesConfig(stats, config)
    reports.push({ role: config.role, file: config.file, bytes: fileStats.size, ...stats })
  }

  const highPoly = reports.find(({ role }) => role === 'high-poly')
  const hitbox = reports.find(({ role }) => role === 'hitbox')

  if (hitbox.positions >= highPoly.positions) {
    throw new Error('The hitbox must be lower density than the high-poly mesh')
  }

  console.log(JSON.stringify(reports, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
