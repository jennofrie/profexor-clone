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
    file: 'profexor-wordmark-v1.glb',
    meshName: 'ProfexorWordmarkV1',
    curveSegments: 10,
    maxEdgeLength: 0.027,
    maxIterations: 18,
    bounds: {
      min: [-5.379567623138428, -0.6652011275291443, -0.13016602396965027],
      max: [5.118360996246338, 0.8445471525192261, 0.13016602396965027]
    },
    limits: {
      minPositions: 150000,
      maxPositions: 180000,
      minUniquePositions: 149000,
      minIndices: 750000,
      maxIndices: 900000,
      maxBytes: 10000000
    }
  },
  {
    role: 'hitbox',
    text: 'PROFEXOR',
    file: 'profexor-wordmark-hitbox-v1.glb',
    meshName: 'ProfexorWordmarkHitboxV1',
    curveSegments: 4,
    maxEdgeLength: 0.13,
    maxIterations: 14,
    bounds: {
      min: [-5.507227420806885, -0.863857626914978, -0.12981197237968445],
      max: [5.369509220123291, 0.9980781674385071, 0.12818847596645355]
    },
    limits: {
      minPositions: 8000,
      maxPositions: 9500,
      minUniquePositions: 6000,
      minIndices: 30000,
      maxIndices: 40000,
      maxBytes: 1000000
    }
  }
]
