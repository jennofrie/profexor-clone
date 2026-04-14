import store from '@scripts/util/store'
import { AmbientLight, DirectionalLight, CanvasTexture, NearestFilter, Raycaster, Vector3, Points, ShaderMaterial, Vector2, BufferGeometry, Uniform, BufferAttribute, Clock, MeshBasicMaterial, Mesh, MathUtils, Group, MeshStandardMaterial, Euler, FrontSide } from 'three'
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js'
import vertexShader from '@scripts/GL/shaders/artefakt/artefakt.vert'
import fragmentShader from '@scripts/GL/shaders/artefakt/artefakt.frag'
import gpgpuParticlesShader from '@scripts/GL/shaders/gpgpu/particles.glsl'
import gsap from 'gsap'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'

export default class Artefakt {
  constructor() {
    this.gl = store.GL
    this.renderer = this.gl.renderer
    this.scene = this.gl.scene
    this.camera = this.gl.camera

    this.previousTime = 0
    this.deltaTime = 0
    this.basePositionY = 0

    this.mouse = new Vector2(-1, 1)
    this.mouseLerp = new Vector2(0, 0)
    this.prevMouse = new Vector3(0, 0, 0)
    this.mouseSpeed = 0
    this.clock = new Clock()

    this.effects = [0, 1, 2, 3, 4]
    this.effect = 0

    this.asciiChars = ' .:-=+*#%@4RT3F'

    this.group = new Group()
    this.group.visible = false
    this.group.name = 'objectGroup'

    this.currentObject = 'artefakt'

    this.defaultLightDir = new Vector3(0.03, 0.19, 0.21)

    this.objects = {
      artefakt: {
        name: 'artefakt',
        model: this.gl.resources.sources.logo.scene.children[0],
        detectionModel: this.gl.resources.sources.logoLowPoly.scene.children[0],
        config: {
          scale: store.isMobile ? store.w.w * 0.08 : store.w.w * 0.07,
          rotation: new Euler(0, 0, 0)
        },
        uniforms: {
          uLightDir: { value: new Vector3(0.1, 1, 1).normalize() },
          uSize: { value: 4 },
          uMouseStrength: { value: 0.1 },
          uFlowFieldInfluence: { value: 0.43 },
          uFlowFieldStrength: { value: 1.09 },
          uFlowFieldFrequency: { value: 0.53 }
        }
      },
    }

    // Only the base logo is guaranteed at construction time.
    // Call registerObject() / registerFace() after loadMore() resolves
    // in the blocks that need them (AboutHero, Team).
    this.faces = []
    this.models = [this.objects.artefakt]

    this.bindMethods()
    this.events()
    this.initRaycaster()
    this.createAsciiTexture()
    this.createLights()
    this.createParticles()
    this.setupPostProcessing()

    const object = this.getModelByName(this.currentObject)

    this.setUniforms(object)

    this.scene.add(this.group)
  }

  bindMethods() {
    this.onMouseMove = this.onMouseMove.bind(this)
    this.onKey = this.onKey.bind(this)
  }

  events() {
    store.emitter.on('mousemove', this.onMouseMove)
    window.addEventListener('keydown', this.onKey)
  }

  setVisible(visible, positionY) {
    this.group.visible = visible

    this.enablePostProcessing(visible)

    if (positionY !== undefined) {
      this.basePositionY = positionY
    }
  }

  onMouseMove(e) {
    this.mouse.x = e.clientX / store.w.w * 2 - 1
    this.mouse.y = - (e.clientY / store.w.h) * 2 + 1
  }

  onKey(e) {
    if (e.key === 'a' || e.key === 'A') {
      this.shuffleEffect()
    }
  }

  shuffleEffect() {
    const effects = [0, 1, 2, 3].filter((effect) => effect !== this.effect)
    const randomEffect = gsap.utils.random(effects)

    this.setEffect(randomEffect)
  }

  /**
   * Register an object (logo-type) that was lazy-loaded.
   * Call from the block's mount() after loadMore() resolves, before swapObject().
   */
  registerObject(name, config) {
    this.objects[name] = { name, ...config }
    this.models.push(this.objects[name])
  }

  /**
   * Register a face model that was lazy-loaded.
   * Call from Team's mount() after loadMore() resolves.
   */
  registerFace(config) {
    this.faces.push(config)
    this.models.push(config)
  }

  getModelByName(name) {
    return this.models.find((model) => model.name === name)
  }

  swapObject(name) {
    const object = this.getModelByName(name)

    if (name === this.currentObject || object === undefined) return

    this.currentObject = name

    const { texture, count } = this.createBaseTextureFromGeometry(object.model.geometry)
    const baseNormalsTexture = this.createNormalsTextureFromGeometry(object.model.geometry)

    this.mesh.geometry = object.detectionModel.geometry

    if (this.effectMesh) {
      this.effectMesh.geometry = object.model.geometry
    }

    // Set new base data
    this.gpgpu.particlesVariable.material.uniforms.uBase.value = texture
    this.gpgpu.particlesVariable.material.uniforms.uBase.needsUpdate = true
    this.gpgpu.particlesVariable.material.uniforms.uBaseNormals.value = baseNormalsTexture.texture
    this.gpgpu.particlesVariable.material.uniforms.uBaseNormals.needsUpdate = true

    const renderTarget = this.gpgpu.computation.getCurrentRenderTarget(this.gpgpu.particlesVariable)

    this.renderer.instance.setRenderTarget(renderTarget)
    this.renderer.instance.clear()
    this.renderer.instance.copyTextureToTexture(texture, renderTarget.texture)
    this.renderer.instance.setRenderTarget(null)

    // Update draw range
    this.particles.geometry.setDrawRange(0, count)

    // Update Normal texture uniform
    this.particles.material.uniforms.uNormalsTexture.value = baseNormalsTexture.texture

    const scale = new Vector3(object.config.scale, object.config.scale, 200)

    // Update model scale
    this.particles.points.scale.copy(scale)
    this.mesh.scale.copy(scale)
    this.effectMesh && this.effectMesh.scale.copy(scale)

    const rotation = object.config.rotation || new Euler(0, 0, 0)

    this.particles.points.rotation.copy(rotation)
    this.mesh.rotation.copy(rotation)
    this.effectMesh && this.effectMesh.rotation.copy(rotation)

    this.setUniforms(object)
  }

  setUniforms(object) {
    if (!object.uniforms) return

    if (object.uniforms.uLightDir) {
      this.particles.material.uniforms.uLightDir.value = object.uniforms.uLightDir.value
    } else {
      this.particles.material.uniforms.uLightDir.value = this.defaultLightDir
    }

    if (object.uniforms.uSize) {
      this.particles.material.uniforms.uSize.value = object.uniforms.uSize.value
    }

    if (object.uniforms.uMouseStrength) {
      this.gpgpu.particlesVariable.material.uniforms.uMouseStrength.value = object.uniforms.uMouseStrength.value
    }

    if (object.uniforms.uFlowFieldInfluence) {
      this.gpgpu.particlesVariable.material.uniforms.uFlowFieldInfluence.value = object.uniforms.uFlowFieldInfluence.value
    }

    if (object.uniforms.uFlowFieldStrength) {
      this.gpgpu.particlesVariable.material.uniforms.uFlowFieldStrength.value = object.uniforms.uFlowFieldStrength.value
    }

    if (object.uniforms.uFlowFieldFrequency) {
      this.gpgpu.particlesVariable.material.uniforms.uFlowFieldFrequency.value = object.uniforms.uFlowFieldFrequency.value
    }
  }

  initRaycaster() {
    this.raycaster = new Raycaster()

    const rayOrigin = new Vector3(- 3, 0, 0)
    const rayDirection = new Vector3(10, 0, 0)

    rayDirection.normalize()

    this.raycaster.set(rayOrigin, rayDirection)
  }

  setupPostProcessing() {    
    // Create a separate camera/scene for the object
    this.particlesLayer = 1
    this.objectLayer = 0
    
    // Assign layers
    this.effectMesh && this.effectMesh.layers.set(this.objectLayer)
    this.particles.points.layers.set(this.particlesLayer)

    // Setup composer
    this.composer = new EffectComposer(this.renderer.instance)

    const scale = store.isMobile ? 0.9 : 0.3

    this.composer.setSize(
      store.w.w * scale,
      store.w.h * scale
    )

    const pixelScale = store.isMobile ? 90 : 180
    const asciiPixelSize = store.w.w * scale / pixelScale

    const postProcessingShader = {
      uniforms: {
        tDiffuse: { value: null },
        uResolution: { value: new Vector2(store.w.w * scale, store.w.h * scale) },
        uAsciiTexture: { value: this.asciiTexture },
        uCharCount: { value: new Vector2(this.asciiChars.length, 1) },
        uAsciiPixelSize: { value: asciiPixelSize },
        uAsciiBrightness: { value: 0.0 },
        uAsciiContrast: { value: 1.09 },
        uAsciiMin: { value: 0.0 },
        uAsciiMax: { value: 1 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 uResolution;
        uniform float uAsciiPixelSize;
        uniform sampler2D uAsciiTexture;
        uniform vec2 uCharCount;
        uniform float uAsciiContrast;
        uniform float uAsciiBrightness;
        uniform float uAsciiMin;
        uniform float uAsciiMax;

        varying vec2 vUv;

        void main() {
          vec2 normalizedPixelSize = uAsciiPixelSize / uResolution;
          vec2 uvPixel = normalizedPixelSize * floor(vUv / normalizedPixelSize);
          vec4 texColor = texture2D(tDiffuse, uvPixel);

          float luma = dot(vec3(0.2126, 0.7152, 0.0722), texColor.rgb);

          // Remap luminance to use full range between min and max
          luma = (luma - uAsciiMin) / (uAsciiMax - uAsciiMin);
          luma = clamp(luma, 0.0, 1.0);

          luma = luma + uAsciiBrightness;
          luma = (luma - 0.5) * uAsciiContrast + 0.5;
          luma = clamp(luma, 0.0, 1.0);

          vec2 cellUV = fract(vUv / normalizedPixelSize);

          float charIndex = clamp(
            floor(luma * (uCharCount.x - 1.0)),
            0.0,
            uCharCount.x - 1.0
          );

          vec2 asciiUV = vec2(
            (charIndex + cellUV.x) / uCharCount.x,
            cellUV.y
          );

          float character = texture2D(uAsciiTexture, asciiUV).r;

          vec3 finalColor = character * vec3(1.0) * (luma + 0.9);
          float alpha = texColor.a * character;

          gl_FragColor = vec4(finalColor, alpha);
        }
      `
    }

    const renderPass = new RenderPass(this.scene, this.camera.instance)

    this.composer.addPass(renderPass)
    
    this.shaderPass = new ShaderPass(postProcessingShader)
    this.composer.addPass(this.shaderPass)
  }

  createLights() {
    this.lights = [
      {
        name: 'main',
        intensity: 10,
        position: new Vector3(0, 0, 5)
      },
      {
        name: 'fillLeft',
        intensity: 0.5,
        position: new Vector3(-5, 0, -5)
      },
      {
        name: 'fillRight',
        intensity: 0.5,
        position: new Vector3(5, 0, -5)
      }
    ]

    this.lights.forEach((lightObject) => {
      const light = new DirectionalLight(0xffffff, lightObject.intensity)

      light.position.copy(lightObject.position)
      lightObject.instance = light
      
      this.scene.add(light)
    })

    // Ambient light for base illumination
    const ambientLight = new AmbientLight(0xffffff, 0.3)

    this.scene.add(ambientLight)
  }

  createBaseTextureFromGeometry(geometry) {
    const count = geometry.attributes.position.count
    const texture = this.gpgpu.computation.createTexture()
    const ORBITER_RATE = 0.01 // 15% of particles become floaters
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      const i4 = i * 4
  
      texture.image.data[i4 + 0] = geometry.attributes.position.array[i3 + 0]
      texture.image.data[i4 + 1] = geometry.attributes.position.array[i3 + 1]
      texture.image.data[i4 + 2] = geometry.attributes.position.array[i3 + 2]
  
      // Use .w as an orbiter flag + small random lifetime for non-orbiters
      if (Math.random() < ORBITER_RATE) {
        texture.image.data[i4 + 3] = 0.0 // flagged as orbiter
      } else {
        texture.image.data[i4 + 3] = Math.random() // regular particle initial life/seed
      }
    }
  
  
    return { texture, count }
  }

  createNormalsTextureFromGeometry(geometry) {
    const count = geometry.attributes.position.count;
    const texture = this.gpgpu.computation.createTexture();
    const data = texture.image.data;

    if (!geometry.attributes.normal) {
      geometry.computeVertexNormals()
    }
    
    const normalAttr = geometry.attributes.normal;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const i4 = i * 4;
  
      data[i4 + 0] = normalAttr.array[i3 + 0];
      data[i4 + 1] = normalAttr.array[i3 + 1];
      data[i4 + 2] = normalAttr.array[i3 + 2];
      data[i4 + 3] = 1.0; // padding
    }
  
    // texture.count = count;

    return {
      texture,
      count
    };
  }

  createParticles() {
    const object = this.objects[this.currentObject]
    const baseGeometry = {}

    baseGeometry.instance = object.model.geometry
    baseGeometry.count = baseGeometry.instance.attributes.position.count

    this.gpgpu = {}

    let maxCount = 0

    for (const key in this.objects) {
      if (!this.objects[key]?.model?.geometry) continue

      const geomCount = this.objects[key].model.geometry.attributes.position.count

      if (geomCount > maxCount) maxCount = geomCount
    }

    // Face scans are registered lazily (after loadMore), so they're not in
    // this.objects yet. Use a safe minimum that fits all known models —
    // 256² = 65,536 particle slots. Adjust if any model exceeds this.
    const MIN_GPGPU_SIZE = 256

    this.gpgpu.size = Math.max(MIN_GPGPU_SIZE, Math.ceil(Math.sqrt(maxCount)))
    this.gpgpu.computation = new GPUComputationRenderer(this.gpgpu.size, this.gpgpu.size, this.renderer.instance)

    const baseParticlesTexture = this.createBaseTextureFromGeometry(baseGeometry.instance)
    const baseNormalsTexture = this.createNormalsTextureFromGeometry(baseGeometry.instance)

    // Particles variables (send uParticles to shader)
    this.gpgpu.particlesVariable = this.gpgpu.computation.addVariable('uParticles', gpgpuParticlesShader, baseParticlesTexture.texture)
    this.gpgpu.computation.setVariableDependencies(this.gpgpu.particlesVariable, [this.gpgpu.particlesVariable])

    // Uniforms
    this.gpgpu.particlesVariable.material.uniforms.uTime = new Uniform(0)
    this.gpgpu.particlesVariable.material.uniforms.uDeltaTime = new Uniform(0)
    this.gpgpu.particlesVariable.material.uniforms.uBase = new Uniform(baseParticlesTexture.texture)
    this.gpgpu.particlesVariable.material.uniforms.uBaseNormals = new Uniform(baseNormalsTexture.texture);
    this.gpgpu.particlesVariable.material.uniforms.uFlowFieldInfluence = new Uniform(0.43)
    this.gpgpu.particlesVariable.material.uniforms.uFlowFieldStrength = new Uniform(1.09)
    this.gpgpu.particlesVariable.material.uniforms.uFlowFieldFrequency = new Uniform(0.53)
    this.gpgpu.particlesVariable.material.uniforms.uVisibility = new Uniform(1)
    this.gpgpu.particlesVariable.material.uniforms.uMouse = new Uniform(new Vector3(0, 0, 0))
    this.gpgpu.particlesVariable.material.uniforms.uMouseRadius = { value: 0.5 }
    this.gpgpu.particlesVariable.material.uniforms.uMouseStrength = { value: 0.072 }
    this.gpgpu.particlesVariable.material.uniforms.uMouseSpeed = { value: 0 }

    this.gpgpu.particlesVariable.material.uniforms.uOrbiterEnabled = new Uniform(1.0)         
    this.gpgpu.particlesVariable.material.uniforms.uOrbiterRadius = new Uniform(0)
    this.gpgpu.particlesVariable.material.uniforms.uOrbiterSpread = new Uniform(10)
    this.gpgpu.particlesVariable.material.uniforms.uOrbiterSpeed = new Uniform(0.2)
    this.gpgpu.particlesVariable.material.uniforms.uOrbiterVertical = new Uniform(0.26)
    this.gpgpu.particlesVariable.material.uniforms.uOrbiterJitter = new Uniform(0)
    this.gpgpu.particlesVariable.material.uniforms.uOrbiterCenter = new Uniform(new Vector3(0, 0, 0))
    this.gpgpu.particlesVariable.material.uniforms.uOrbiterBlend = new Uniform(1.0)

    // Init
    this.gpgpu.computation.init()

    this.particles = {
      group: new Group()
    }

    this.particles.group.name = 'particlesGroup'

    // Geometry
    // Multiplied by 2 because uv is x and y
    const particlesUvArray = new Float32Array(baseParticlesTexture.count * 2)
    const sizesArray = new Float32Array(baseParticlesTexture.count)

    for (let y = 0; y < this.gpgpu.size; y++) {
      for (let x = 0; x < this.gpgpu.size; x++) {
        // From 0 to array size
        const i = (y * this.gpgpu.size) + x
        const i2 = i * 2

        // Particles UV
        const uvX = (x + 0.5) / this.gpgpu.size
        const uvY = (y + 0.5) / this.gpgpu.size

        particlesUvArray[i2] = uvX
        particlesUvArray[i2 + 1] = uvY

        sizesArray[i] = Math.random()
      }
    }

    this.particles.geometry = new BufferGeometry()
    this.particles.geometry.setDrawRange(0, baseParticlesTexture.count)
    this.particles.geometry.setAttribute('aParticlesUv', new BufferAttribute(particlesUvArray, 2))
    this.particles.geometry.setAttribute('aSize', new BufferAttribute(sizesArray, 1))

    // Material
    this.particles.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      uniforms: {
        uSize: { value: 30 },
        uProgress: { value: 0 },
        uLightDir: { value: new Vector3(0, 0.19, 0.21).normalize() },
        uResolution: { value: new Vector2(store.w.w, store.w.h) },
        uParticlesTexture: new Uniform(),
        uNormalsTexture: new Uniform(baseNormalsTexture.texture),
        uVisibility: { value: 0 }
      }
    })

    // Points
    this.particles.points = new Points(this.particles.geometry, this.particles.material)
    
    this.particles.points.name = 'particles'
    this.particles.points.scale.set(object.config.scale, object.config.scale, 200)
    this.particles.points.frustumCulled = false

    this.mesh = new Mesh(object.detectionModel.geometry, new MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false
    }))

    this.mesh.renderOrder = 0

    this.mesh.name = 'lowPolyModel'
    this.mesh.scale.set(object.config.scale, object.config.scale, 200)

    this.particles.group.add(this.mesh)
    this.particles.group.add(this.particles.points)

    this.group.add(this.particles.group)
  }

  createAsciiTexture() {
    this.asciiTexture && this.asciiTexture.dispose()

    const pixelSize = 16 // Character size in pixels
    const fontFamily = 'monospace'
    
    const CHAR_SIZE = pixelSize
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    canvas.width = CHAR_SIZE * this.asciiChars.length
    canvas.height = CHAR_SIZE
    
    ctx.fillStyle = 'black'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = 'white'
    ctx.font = `${CHAR_SIZE}px ${fontFamily}`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    
    this.asciiChars.split('').forEach((char, i) => {
      ctx.fillText(char, (i + 0.5) * CHAR_SIZE, CHAR_SIZE / 2)
    })
    
    this.asciiTexture = new CanvasTexture(canvas)

    this.asciiTexture.minFilter = NearestFilter
    this.asciiTexture.magFilter = NearestFilter
  }

  createObject() {
    const object = this.objects[this.currentObject]
    const material = new MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.5,
      metalness: 1,
      side: FrontSide
    })

    this.effectMesh = new Mesh(object.model.geometry, material)

    this.effectMesh.name = 'effectMesh'
    this.effectMesh.scale.set(object.config.scale, object.config.scale, 200)
    this.effectMesh.position.z = -200
    this.effectMesh.visible = false

    this.group.add(this.effectMesh)
  }

  /**
   * 
   * @param {Number} effect 0 = Particles / 1 = Pixels / 2 = Stripes / 3 = ASCII / 4 = Raw object
   */
  setEffect(effect) {
    this.effect = effect

    if (effect === 0) {
      if (this.effectMesh) this.effectMesh.visible = false
      
      // Set ascii effect
      this.shaderPass.uniforms.uEffectMode.value = 3

      this.particles.group.visible = true
    } else {
      this.particles.group.visible = false

      this.shaderPass.uniforms.uEffectMode.value = effect
      if (this.effectMesh) this.effectMesh.visible = true
    }

    // Disable lights for pixel/stripe effects
    if (effect === 2) {
      this.enableLights(false)
    } else {
      this.enableLights(true)
    }
  }

  enablePostProcessing(enable = true) {
    store.renderToBuffer = enable
  }

  enableLights(enable = true) {
    this.lights.forEach((light) => {
      light.instance.intensity = enable ? light.intensity : 0
    })
  }

  resize() {
    this.objects.artefakt.config.scale = store.isMobile ? store.w.w * 0.08 : store.w.w * 0.07
    if (this.objects.a) this.objects.a.config.scale = store.isMobile ? store.w.w * 0.4 : store.w.w * 0.15
  
    const object = this.getModelByName(this.currentObject)

    const scale = new Vector3(object.config.scale, object.config.scale, 200)

    this.particles.points.scale.copy(scale)
    this.mesh.scale.copy(scale)
    this.effectMesh && this.effectMesh.scale.copy(scale)

    if (this.composer) {
      const scale = store.isMobile ? 0.9 : 0.3
  
      this.composer.setSize(store.w.w * scale, store.w.h * scale)

      this.composer.passes.forEach(pass => {
        if (pass.camera) {
          pass.camera = this.camera.instance
        }
      })
  
      if (this.shaderPass && this.shaderPass.uniforms.uResolution) {
        this.shaderPass.uniforms.uResolution.value.set(store.w.w * scale, store.w.h * scale)
      }

      const pixelScale = store.isMobile ? 100 : 145

      this.shaderPass.uniforms.uAsciiPixelSize.value = (store.w.w * scale) / pixelScale
    }
  
    if (this.particles && this.particles.material.uniforms.uResolution) {
      this.particles.material.uniforms.uResolution.value.set(store.w.w, store.w.h)
    }

  }

  update() {
    const elapsedTime = this.clock.getElapsedTime()
    const deltaTime = elapsedTime - this.previousTime

    this.previousTime = elapsedTime

    if (this.particles && this.effect === 0) {
      // Update uniforms before computation
      this.gpgpu.particlesVariable.material.uniforms.uTime.value = elapsedTime
      this.gpgpu.particlesVariable.material.uniforms.uDeltaTime.value = deltaTime
  
      // GPGPU Update
      this.gpgpu.computation.compute()
      this.particles.material.uniforms.uParticlesTexture.value = this.gpgpu.computation.getCurrentRenderTarget(this.gpgpu.particlesVariable).texture
  
      if (this.mesh && !store.isMobile) {
        this.raycaster.setFromCamera(this.mouse, this.camera.instance)
        
        const intersects = this.raycaster.intersectObjects([this.mesh])
    
        if (intersects.length > 0) {
          const worldPoint = intersects[0].point
          const localPoint = this.mesh.worldToLocal(worldPoint.clone())
  
          const targetSpeed = this.mouseSpeed * 500
  
          this.gpgpu.particlesVariable.material.uniforms.uMouseSpeed.value = MathUtils.lerp(this.gpgpu.particlesVariable.material.uniforms.uMouseSpeed.value, targetSpeed, 0.15)
  
          this.mouseSpeed = localPoint.distanceTo(this.prevMouse)
    
          this.prevMouse.copy(localPoint)
          this.gpgpu.particlesVariable.material.uniforms.uMouse.value = localPoint
        } else {
          // When not intersecting, gradually reduce speed to 0
          this.gpgpu.particlesVariable.material.uniforms.uMouseSpeed.value *= 0.9
        }
      }
    }

    if (this.composer && store.renderToBuffer) {
      this.camera.instance.layers.set(1)
      this.renderer.instance.autoClear = true
      this.composer.render()
      
      this.renderer.instance.clearDepth()

      this.camera.instance.layers.set(0)
      this.renderer.instance.autoClear = false
      this.renderer.instance.render(this.scene, this.camera.instance)
      
      this.renderer.instance.autoClear = true
    }

    this.group.position.y = this.basePositionY + store.smoothScroll.animatedScroll

    this.mouseLerp.x = store.lerp(this.mouseLerp.x, this.mouse.x, 0.09)
    this.mouseLerp.y = store.lerp(this.mouseLerp.y, this.mouse.y, 0.09)

    this.group.rotation.x = 0.2 * (this.mouseLerp.y * -1)
    this.group.rotation.y = 0.05 * this.mouseLerp.x
  }
}