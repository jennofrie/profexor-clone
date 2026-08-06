import * as THREE from 'three'
import { TessellateModifier } from 'three/examples/jsm/modifiers/TessellateModifier.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const BOUNDS_TOLERANCE = 0.00001

export function opentypePathToShapes(opentypePath) {
  const shapePath = new THREE.ShapePath()

  for (const command of opentypePath.commands) {
    switch (command.type) {
      case 'M':
        shapePath.moveTo(command.x, -command.y)
        break
      case 'L':
        shapePath.lineTo(command.x, -command.y)
        break
      case 'C':
        shapePath.bezierCurveTo(
          command.x1,
          -command.y1,
          command.x2,
          -command.y2,
          command.x,
          -command.y
        )
        break
      case 'Q':
        shapePath.quadraticCurveTo(command.x1, -command.y1, command.x, -command.y)
        break
      case 'Z':
        shapePath.currentPath?.closePath()
        break
      default:
        throw new Error(`Unsupported OpenType path command: ${command.type}`)
    }
  }

  // OpenType's outer contours become clockwise after the Y-axis flip above.
  // Three.js therefore needs its default clockwise-shape interpretation.
  // Passing `true` here inverts letters and counters (for example, treating
  // the open space around P/R/O as the solid geometry).
  return shapePath.toShapes(false)
}

export function fitGeometryToBounds(geometry, bounds) {
  geometry.computeBoundingBox()

  const sourceSize = new THREE.Vector3()
  geometry.boundingBox.getSize(sourceSize)

  if (sourceSize.x === 0 || sourceSize.y === 0 || sourceSize.z === 0) {
    throw new Error('Cannot fit geometry with a zero-size axis')
  }

  const targetMin = new THREE.Vector3(...bounds.min)
  const targetMax = new THREE.Vector3(...bounds.max)
  const targetSize = targetMax.clone().sub(targetMin)
  const targetCenter = targetMin.clone().add(targetMax).multiplyScalar(0.5)

  geometry.scale(
    targetSize.x / sourceSize.x,
    targetSize.y / sourceSize.y,
    targetSize.z / sourceSize.z
  )

  geometry.computeBoundingBox()
  const scaledCenter = new THREE.Vector3()
  geometry.boundingBox.getCenter(scaledCenter)
  geometry.translate(...targetCenter.clone().sub(scaledCenter).toArray())
  geometry.computeBoundingBox()

  return geometry
}

export function createRemeshedTextGeometry(font, config) {
  const fontPath = font.getPath(config.text, 0, 0, 1000, { kerning: true })
  const shapes = opentypePathToShapes(fontPath)

  if (shapes.length === 0) {
    throw new Error(`No shapes were generated for ${config.text}`)
  }

  const extruded = new THREE.ExtrudeGeometry(shapes, {
    depth: 18,
    steps: 1,
    bevelEnabled: false,
    curveSegments: config.curveSegments
  })

  fitGeometryToBounds(extruded, config.bounds)

  // The runtime only consumes positions and normals. Removing UVs also allows
  // vertices on each flat face to be welded into an efficient indexed mesh.
  extruded.deleteAttribute('uv')
  extruded.computeVertexNormals()

  const tessellationZScale = config.tessellationZScale ?? 1

  if (!Number.isFinite(tessellationZScale) || tessellationZScale <= 0) {
    throw new Error(`Invalid tessellation Z scale: ${tessellationZScale}`)
  }

  // Tessellate the visible XY letter faces more densely than the extrusion
  // walls. Restoring Z after subdivision preserves the exact world bounds.
  // This mirrors the particle distribution of the Blender-remeshed original
  // instead of spending most particle vertices inside the thin side walls.
  extruded.scale(1, 1, tessellationZScale)

  const tessellated = new TessellateModifier(
    config.maxEdgeLength,
    config.maxIterations
  ).modify(extruded)

  extruded.dispose()
  tessellated.scale(1, 1, 1 / tessellationZScale)

  const indexed = mergeVertices(tessellated, 0.000001)
  tessellated.dispose()
  indexed.normalizeNormals()
  indexed.computeBoundingBox()
  indexed.computeBoundingSphere()

  return indexed
}

function countUniquePositions(positionAttribute, tolerance = 0.000001) {
  const multiplier = 1 / tolerance
  const positions = new Set()

  for (let index = 0; index < positionAttribute.count; index++) {
    positions.add([
      Math.round(positionAttribute.getX(index) * multiplier),
      Math.round(positionAttribute.getY(index) * multiplier),
      Math.round(positionAttribute.getZ(index) * multiplier)
    ].join(','))
  }

  return positions.size
}

function analyzeTriangles(geometry) {
  const position = geometry.getAttribute('position')
  const index = geometry.getIndex()

  if (!index) {
    throw new Error('Expected an indexed geometry')
  }

  let maxEdgeLength = 0
  let maxFrontBackEdgeLength = 0
  let degenerateTriangles = 0
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const ab = new THREE.Vector3()
  const ac = new THREE.Vector3()

  for (let offset = 0; offset < index.count; offset += 3) {
    a.fromBufferAttribute(position, index.getX(offset))
    b.fromBufferAttribute(position, index.getX(offset + 1))
    c.fromBufferAttribute(position, index.getX(offset + 2))

    const triangleMaxEdgeLength = Math.max(
      a.distanceTo(b),
      b.distanceTo(c),
      c.distanceTo(a)
    )
    maxEdgeLength = Math.max(maxEdgeLength, triangleMaxEdgeLength)

    const onFront = [a, b, c].every(
      (point) => Math.abs(point.z - geometry.boundingBox.max.z) <= BOUNDS_TOLERANCE
    )
    const onBack = [a, b, c].every(
      (point) => Math.abs(point.z - geometry.boundingBox.min.z) <= BOUNDS_TOLERANCE
    )

    if (onFront || onBack) {
      maxFrontBackEdgeLength = Math.max(maxFrontBackEdgeLength, triangleMaxEdgeLength)
    }

    ab.subVectors(b, a)
    ac.subVectors(c, a)

    if (ab.cross(ac).lengthSq() <= Number.EPSILON) {
      degenerateTriangles++
    }
  }

  return { maxEdgeLength, maxFrontBackEdgeLength, degenerateTriangles }
}

export function inspectGeometry(geometry) {
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  const index = geometry.getIndex()

  if (!position || position.itemSize !== 3) {
    throw new Error('Geometry must contain VEC3 positions')
  }

  if (!normal || normal.itemSize !== 3 || normal.count !== position.count) {
    throw new Error('Geometry must contain one VEC3 normal per position')
  }

  if (!index || index.count % 3 !== 0) {
    throw new Error('Geometry must contain a triangle index')
  }

  for (const [name, attribute] of [['position', position], ['normal', normal]]) {
    for (const value of attribute.array) {
      if (!Number.isFinite(value)) {
        throw new Error(`${name} attribute contains a non-finite value`)
      }
    }
  }

  geometry.computeBoundingBox()
  let frontFacingPositions = 0
  let backFacingPositions = 0
  let sideFacingPositions = 0
  let frontPlanePositions = 0
  let backPlanePositions = 0
  const uniqueFrontPlanePositions = new Set()

  for (let index = 0; index < position.count; index++) {
    const normalZ = normal.getZ(index)

    if (normalZ > 0.9) {
      frontFacingPositions++
    } else if (normalZ < -0.9) {
      backFacingPositions++
    } else {
      sideFacingPositions++
    }

    const positionZ = position.getZ(index)

    if (Math.abs(positionZ - geometry.boundingBox.max.z) <= BOUNDS_TOLERANCE) {
      frontPlanePositions++
      uniqueFrontPlanePositions.add([
        Math.round(position.getX(index) * 1000000),
        Math.round(position.getY(index) * 1000000)
      ].join(','))
    }

    if (Math.abs(positionZ - geometry.boundingBox.min.z) <= BOUNDS_TOLERANCE) {
      backPlanePositions++
    }
  }

  const triangleStats = analyzeTriangles(geometry)

  return {
    positions: position.count,
    uniquePositions: countUniquePositions(position),
    indices: index.count,
    triangles: index.count / 3,
    min: geometry.boundingBox.min.toArray(),
    max: geometry.boundingBox.max.toArray(),
    frontFacingPositions,
    backFacingPositions,
    sideFacingPositions,
    frontPlanePositions,
    backPlanePositions,
    uniqueFrontPlanePositions: uniqueFrontPlanePositions.size,
    ...triangleStats
  }
}

function assertBounds(actual, expected, label) {
  for (let axis = 0; axis < 3; axis++) {
    if (Math.abs(actual[axis] - expected[axis]) > BOUNDS_TOLERANCE) {
      throw new Error(
        `${label} axis ${axis} is ${actual[axis]}, expected ${expected[axis]}`
      )
    }
  }
}

export function assertGeometryMatchesConfig(stats, config) {
  const { limits } = config

  if (stats.positions < limits.minPositions || stats.positions > limits.maxPositions) {
    throw new Error(
      `${config.role} position count ${stats.positions} is outside ` +
      `${limits.minPositions}-${limits.maxPositions}`
    )
  }

  if (stats.uniquePositions < limits.minUniquePositions) {
    throw new Error(
      `${config.role} has only ${stats.uniquePositions} unique positions; ` +
      `${limits.minUniquePositions} are required`
    )
  }

  if (stats.indices < limits.minIndices || stats.indices > limits.maxIndices) {
    throw new Error(
      `${config.role} index count ${stats.indices} is outside ` +
      `${limits.minIndices}-${limits.maxIndices}`
    )
  }

  if (stats.degenerateTriangles !== 0) {
    throw new Error(`${config.role} contains ${stats.degenerateTriangles} degenerate triangles`)
  }

  const maxWorldEdgeLength = limits.maxWorldEdgeLength ?? config.maxEdgeLength * 1.001

  if (stats.maxEdgeLength > maxWorldEdgeLength) {
    throw new Error(
      `${config.role} maximum edge ${stats.maxEdgeLength} exceeds ` +
      `${maxWorldEdgeLength}`
    )
  }

  if (
    limits.maxFrontBackEdgeLength !== undefined &&
    stats.maxFrontBackEdgeLength > limits.maxFrontBackEdgeLength
  ) {
    throw new Error(
      `${config.role} front/back maximum edge ${stats.maxFrontBackEdgeLength} exceeds ` +
      `${limits.maxFrontBackEdgeLength}`
    )
  }

  for (const [statName, minimumName] of [
    ['frontFacingPositions', 'minFrontFacingPositions'],
    ['frontPlanePositions', 'minFrontPlanePositions'],
    ['uniqueFrontPlanePositions', 'minUniqueFrontPlanePositions']
  ]) {
    if (limits[minimumName] !== undefined && stats[statName] < limits[minimumName]) {
      throw new Error(
        `${config.role} ${statName} ${stats[statName]} is below ${limits[minimumName]}`
      )
    }
  }

  if (
    limits.maxFrontPlanePositions !== undefined &&
    stats.frontPlanePositions > limits.maxFrontPlanePositions
  ) {
    throw new Error(
      `${config.role} frontPlanePositions ${stats.frontPlanePositions} exceeds ` +
      `${limits.maxFrontPlanePositions}`
    )
  }

  assertBounds(stats.min, config.bounds.min, `${config.role} minimum bound`)
  assertBounds(stats.max, config.bounds.max, `${config.role} maximum bound`)
}
