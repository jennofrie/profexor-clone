import fs from 'node:fs/promises'
import path from 'node:path'
import { projectRoot } from './model-config.mjs'

const assetsDirectory = path.join(
  projectRoot,
  'wp-content/themes/gl/public/build/assets'
)
const inputBundleName = 'app-Cd2tpxcC.js'
const outputBundleName = 'app-profexor-v1.js'
const versionTag = 'profexor-v1'
const modelReplacements = new Map([
  ['artefakt.glb', 'profexor-wordmark-v1.glb'],
  ['artefakt-low-poly.glb', 'profexor-wordmark-hitbox-v1.glb']
])

function countOccurrences(source, search) {
  return source.split(search).length - 1
}

function versionedAssetName(name) {
  if (name === inputBundleName) return outputBundleName
  return name.replace(/\.js$/, `-${versionTag}.js`)
}

function findRelativeJavaScriptDependencies(source) {
  return [...source.matchAll(/\.\/([A-Za-z0-9_.-]+\.js)/g)]
    .map((match) => match[1])
}

async function listHtmlFiles(directory) {
  const files = []

  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue

    const entryPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...await listHtmlFiles(entryPath))
    } else if (entry.name.endsWith('.html')) {
      files.push(entryPath)
    }
  }

  return files
}

async function collectModuleGraph() {
  const graph = new Set()
  const queue = [inputBundleName]

  while (queue.length > 0) {
    const assetName = queue.shift()
    if (graph.has(assetName)) continue

    const assetPath = path.join(assetsDirectory, assetName)
    const source = await fs.readFile(assetPath, 'utf8')
    graph.add(assetName)

    for (const dependency of findRelativeJavaScriptDependencies(source)) {
      const dependencyPath = path.join(assetsDirectory, dependency)

      try {
        await fs.access(dependencyPath)
      } catch (error) {
        throw new Error(`${assetName} references missing module ${dependency}`, { cause: error })
      }

      if (!graph.has(dependency)) queue.push(dependency)
    }
  }

  return graph
}

async function buildVersionedModuleGraph() {
  const graph = await collectModuleGraph()
  const assetNames = new Map(
    [...graph].map((assetName) => [assetName, versionedAssetName(assetName)])
  )
  const modelOccurrenceCounts = new Map(
    [...modelReplacements].map(([oldName]) => [oldName, 0])
  )

  for (const assetName of graph) {
    const inputFile = path.join(assetsDirectory, assetName)
    const outputFile = path.join(assetsDirectory, assetNames.get(assetName))
    let source = await fs.readFile(inputFile, 'utf8')

    for (const [dependency, versionedDependency] of assetNames) {
      // Vite records each chunk twice: once in the import specifier and once
      // in its module-preload dependency table. Replace the basename so both
      // references stay on the same versioned module graph.
      source = source.replaceAll(dependency, versionedDependency)
    }

    for (const [oldName, newName] of modelReplacements) {
      const occurrences = countOccurrences(source, oldName)
      modelOccurrenceCounts.set(oldName, modelOccurrenceCounts.get(oldName) + occurrences)
      source = source.replaceAll(oldName, newName)
    }

    await fs.writeFile(outputFile, source)
  }

  for (const [oldName, occurrences] of modelOccurrenceCounts) {
    if (occurrences !== 1) {
      throw new Error(
        `Production module graph contains ${occurrences} occurrences of ${oldName}; expected one`
      )
    }
  }

  return assetNames
}

async function updateHtmlReferences() {
  const htmlFiles = await listHtmlFiles(projectRoot)
  let replacedReferences = 0
  let currentReferences = 0

  for (const file of htmlFiles) {
    const source = await fs.readFile(file, 'utf8')
    const oldCount = countOccurrences(source, inputBundleName)
    const currentCount = countOccurrences(source, outputBundleName)

    if (oldCount > 0) {
      await fs.writeFile(file, source.replaceAll(inputBundleName, outputBundleName))
      replacedReferences += oldCount
    }

    currentReferences += currentCount + oldCount
  }

  if (currentReferences === 0) {
    throw new Error(`No HTML files reference ${inputBundleName} or ${outputBundleName}`)
  }

  return { htmlFiles: htmlFiles.length, references: currentReferences, replacedReferences }
}

async function verifyIntegration(assetNames) {
  for (const [originalName, versionedName] of assetNames) {
    const outputFile = path.join(assetsDirectory, versionedName)
    const output = await fs.readFile(outputFile, 'utf8')

    for (const dependency of assetNames.keys()) {
      if (output.includes(dependency)) {
        throw new Error(`${versionedName} still references unversioned ${dependency}`)
      }
    }

    for (const [oldName] of modelReplacements) {
      if (output.includes(oldName)) {
        throw new Error(`${versionedName} still contains ${oldName}`)
      }
    }

    for (const dependency of findRelativeJavaScriptDependencies(output)) {
      try {
        await fs.access(path.join(assetsDirectory, dependency))
      } catch (error) {
        throw new Error(`${versionedName} references missing module ${dependency}`, { cause: error })
      }
    }

    if (originalName === inputBundleName) {
      for (const [, newName] of modelReplacements) {
        if (countOccurrences(output, newName) !== 1) {
          throw new Error(`${versionedName} does not contain exactly one ${newName}`)
        }
      }
    }
  }

  const htmlFiles = await listHtmlFiles(projectRoot)

  for (const file of htmlFiles) {
    const source = await fs.readFile(file, 'utf8')

    if (source.includes(inputBundleName)) {
      throw new Error(`${path.relative(projectRoot, file)} still references ${inputBundleName}`)
    }
  }
}

const assetNames = await buildVersionedModuleGraph()
const report = await updateHtmlReferences()
await verifyIntegration(assetNames)
console.log(JSON.stringify({
  inputBundleName,
  outputBundleName,
  versionedModules: assetNames.size,
  ...report
}, null, 2))
