import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import { createFont, woff2 } from 'fonteditor-core'
import opentype from 'opentype.js'
import * as THREE from 'three'
import { fitGeometryToBounds, inspectGeometry, opentypePathToShapes } from './geometry.mjs'
import { fontFile } from './model-config.mjs'

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

test('preserves the Profexor letter faces and counters', async () => {
  await woff2.init()

  const woff2Buffer = await fs.readFile(fontFile)
  const fontSource = createFont(woff2Buffer, { type: 'woff2' })
  const ttfBuffer = Buffer.from(fontSource.write({ type: 'ttf' }))
  const arrayBuffer = ttfBuffer.buffer.slice(
    ttfBuffer.byteOffset,
    ttfBuffer.byteOffset + ttfBuffer.byteLength
  )
  const font = opentype.parse(arrayBuffer)
  const fontPath = font.getPath('PROFEXOR', 0, 0, 1000, { kerning: true })
  const shapes = opentypePathToShapes(fontPath)

  assert.equal(shapes.length, 8)
  assert.equal(
    shapes.reduce((total, shape) => total + shape.holes.length, 0),
    5
  )

  const outerArea = shapes.reduce(
    (total, shape) => total + Math.abs(THREE.ShapeUtils.area(shape.getPoints())),
    0
  )
  const counterArea = shapes.reduce(
    (total, shape) => total + shape.holes.reduce(
      (shapeTotal, hole) => (
        shapeTotal + Math.abs(THREE.ShapeUtils.area(hole.getPoints()))
      ),
      0
    ),
    0
  )

  assert.ok(outerArea > counterArea)
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
