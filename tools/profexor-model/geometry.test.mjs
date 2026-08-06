import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { fitGeometryToBounds, inspectGeometry, opentypePathToShapes } from './geometry.mjs'

test('converts a closed OpenType contour to a Three.js shape', () => {
  const shapes = opentypePathToShapes({
    commands: [
      { type: 'M', x: 0, y: 0 },
      { type: 'L', x: 1, y: 0 },
      { type: 'L', x: 1, y: 1 },
      { type: 'L', x: 0, y: 1 },
      { type: 'Z' }
    ]
  })

  assert.equal(shapes.length, 1)
})

test('fits geometry to an asymmetric target bounding box', () => {
  const geometry = new THREE.BoxGeometry(2, 4, 6)
  const bounds = {
    min: [-5, -2, -0.25],
    max: [4, 3, 0.5]
  }

  fitGeometryToBounds(geometry, bounds)
  geometry.computeBoundingBox()

  assert.deepEqual(geometry.boundingBox.min.toArray(), bounds.min)
  assert.deepEqual(geometry.boundingBox.max.toArray(), bounds.max)
  geometry.dispose()
})

test('inspects a finite indexed triangle mesh', () => {
  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const stats = inspectGeometry(geometry)

  assert.equal(stats.positions, 24)
  assert.equal(stats.indices, 36)
  assert.equal(stats.degenerateTriangles, 0)
  geometry.dispose()
})
