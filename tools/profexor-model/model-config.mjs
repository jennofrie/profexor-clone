import path from 'node:path'
import { fileURLToPath } from 'node:url'

const toolDirectory = path.dirname(fileURLToPath(import.meta.url))

export const projectRoot = path.resolve(toolDirectory, '..', '..')
export const sourceDirectory = path.join(
  projectRoot,
  'wp-content/themes/gl/resources/js/GL/sources'
)
export const fontFile = path.join(
  projectRoot,
  'wp-content/themes/gl/public/build/assets/DrukWide-Bold-C5cdApem.woff2'
)

export const modelConfigs = [
  {
    role: 'high-poly',
    text: 'PROFEXOR',
    file: 'profexor-wordmark-v2.glb',
    meshName: 'ProfexorWordmarkV2',
    curveSegments: 10,
    maxEdgeLength: 0.04,
    maxIterations: 24,
    tessellationZScale: 0.02,
    bounds: {
      min: [-5.379567623138428, -0.6652011275291443, -0.13016602396965027],
      max: [5.118360996246338, 0.8445471525192261, 0.13016602396965027]
    },
    limits: {
      minPositions: 100000,
      maxPositions: 110000,
      minUniquePositions: 90000,
      minIndices: 550000,
      maxIndices: 620000,
      minFrontFacingPositions: 40000,
      minFrontPlanePositions: 45000,
      maxFrontPlanePositions: 51000,
      minUniqueFrontPlanePositions: 41000,
      maxWorldEdgeLength: 0.27,
      maxFrontBackEdgeLength: 0.0401,
      maxBytes: 10000000
    }
  },
  {
    role: 'hitbox',
    text: 'PROFEXOR',
    file: 'profexor-wordmark-hitbox-v2.glb',
    meshName: 'ProfexorWordmarkHitboxV2',
    curveSegments: 4,
    maxEdgeLength: 0.25,
    maxIterations: 14,
    bounds: {
      min: [-5.507227420806885, -0.863857626914978, -0.12981197237968445],
      max: [5.369509220123291, 0.9980781674385071, 0.12818847596645355]
    },
    limits: {
      minPositions: 8200,
      maxPositions: 9000,
      minUniquePositions: 5000,
      minIndices: 30000,
      maxIndices: 34000,
      maxBytes: 1000000
    }
  }
]
