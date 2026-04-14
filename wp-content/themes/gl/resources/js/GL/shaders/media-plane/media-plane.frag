uniform float uProgress;
uniform float uMode;
uniform float uAlpha;
uniform float uDisablePixel;

uniform vec2 uMeshSize;
uniform vec2 uImageSize;
uniform vec2 uImageSize2;

uniform sampler2D uDataTexture;

uniform sampler2D uTexture;
uniform sampler2D uTexture2;
uniform float uPixelSize;

uniform float uAsciiPixelSize;
uniform float uRevealHeight;
uniform sampler2D uAsciiTexture;
uniform vec2 uCharCount;

uniform bool uBlueWhiteMode;
uniform bool uPixelationEnabled;
uniform bool uPixelationEnabled2;
uniform bool uShowAsciiOnly;

uniform float uPixels[11];
uniform float uPixelsLength;

varying vec2 vUv;

vec2 aspect(in vec2 size, in float scale) {
  return scale / size;
}

vec2 aspectCover(vec2 uv, vec2 imageSize, vec2 meshSize) {
  vec2 safeImageSize = max(imageSize, vec2(0.0001));
  vec2 sizeRatio = safeImageSize / meshSize;
  vec2 newSize = aspect(sizeRatio, min(sizeRatio.x, sizeRatio.y));
  vec2 centeredSize = uv * newSize + (1. - newSize) * 0.5;
  return centeredSize;
}

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float noise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));
  
  vec2 u = f * f * (3.0 - 2.0 * f);
  
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float revealMask(float prog, vec2 pUV, out float distortedProgress) {
  float progress =
    (1.0 + uRevealHeight) -
    (prog * (1.0 + uRevealHeight + uRevealHeight));
  
  // Diagonal factor that decreases as progress increases
  float diagonalFactor = (1.0 - prog) * 0.5;
  
  // Create diagonal movement
  float diagonal = pUV.y - pUV.x * diagonalFactor;
  
  // Optional noise
  float noiseIntensity = (1.0 - prog) * 0.05;
  float noiseVal = noise(pUV * 6.0) * noiseIntensity;
  
  distortedProgress = diagonal + noiseVal;
  
  float yDist = abs(distortedProgress - progress);
  float rand = random(pUV);

  return step(1.0 - uRevealHeight * rand, 1.0 - yDist);
}

void main() {
  vec2 uv = vUv;
  vec3 uBlueColor = vec3(0.0, 0.0, 1.0);

  // DataTexture distortion
  vec4 offset = texture2D(uDataTexture, vUv);
  uv -= offset.rg * 0.1 * uDisablePixel;

  vec2 meshPos = vUv * uMeshSize;

  /* --------------------------------------------------
     Pixelated UV (for reveal, etc.)
  -------------------------------------------------- */
  vec2 cell = floor(meshPos / uPixelSize);
  vec2 pixelCenter = (cell + 0.5) * uPixelSize;
  vec2 pixelUV = pixelCenter / uMeshSize;

  // Define your discrete pixel sizes
  // Map uProgress (0..1) to the correct index in pixelSizes
  float p = mix(1. - uProgress, uProgress, uMode);
  float index = floor(clamp(p, 0.4, 1.) * uPixelsLength);
  index = clamp(index, 0.0, uPixelsLength);
  int i = int(index);

  float animatedPixelSize = uPixels[i];

  // For tex2, use the REVERSE index
  float pReverse = 1.0 - p;
  float indexReverse = floor(clamp(pReverse, 0.4, 1.) * uPixelsLength);
  indexReverse = clamp(indexReverse, 0.0, uPixelsLength);
  int iReverse = int(indexReverse);
  float animatedPixelSizeReverse = uPixels[iReverse];

  // Compute pixelUV for tex1 (unpixelating)
  vec2 cellTex = floor(meshPos / animatedPixelSize);
  vec2 pixelCenterTex = (cellTex + 0.5) * animatedPixelSize;
  vec2 pixelUVTex = pixelCenterTex / uMeshSize;

  // Compute pixelUV for tex2 (pixelating - reverse)
  vec2 cellTex2 = floor(meshPos / animatedPixelSizeReverse);
  vec2 pixelCenterTex2 = (cellTex2 + 0.5) * animatedPixelSizeReverse;
  vec2 pixelUVTex2 = pixelCenterTex2 / uMeshSize;

  vec2 enabledTexUV = uPixelationEnabled ? pixelUVTex : uv;
  vec2 enabledTexUV2 = uPixelationEnabled2 ? pixelUVTex2 : uv;

  vec2 coverUV = aspectCover(enabledTexUV, uImageSize, uMeshSize);
  vec4 tex = texture2D(uTexture, coverUV);

  vec2 coverUV2 = aspectCover(enabledTexUV2, uImageSize2, uMeshSize);
  vec4 tex2 = texture2D(uTexture2, coverUV2);

  /* --------------------------------------------------
     ASCII effect (independent grid)
  -------------------------------------------------- */
  vec2 asciiCell = floor(meshPos / uAsciiPixelSize);
  vec2 asciiCellUV = fract(meshPos / uAsciiPixelSize);
  vec2 asciiCoverUV  = aspectCover((asciiCell + 0.5) * uAsciiPixelSize / uMeshSize, uImageSize,  uMeshSize);
  vec2 asciiCoverUV2 = aspectCover((asciiCell + 0.5) * uAsciiPixelSize / uMeshSize, uImageSize2, uMeshSize);

  // Sample both textures
  vec4 asciiTex1 = texture2D(uTexture,  asciiCoverUV);
  vec4 asciiTex2 = texture2D(uTexture2, asciiCoverUV2);
  
  // Calculate masks for ASCII position
  vec2 asciiPixelUV = (asciiCell + 0.5) * uAsciiPixelSize / uMeshSize;
  float asciiDistortedPos;
  float asciiReveal = revealMask(uProgress, asciiPixelUV, asciiDistortedPos);
  float asciiProgress = (1.0 + uRevealHeight) - (uProgress * (1.0 + uRevealHeight + uRevealHeight));
  float asciiPassed = step(asciiProgress, asciiDistortedPos);
  float asciiTex1Mask = 1.0 - max(asciiReveal, asciiPassed);
  float asciiTex2Mask = max(asciiReveal, asciiPassed) - asciiReveal;
  
  // For the ASCII BAND: always use uTexture (asciiTex1)
  vec4 asciiBandTex = mix(asciiTex1, asciiTex2, uMode);
  float lumaBand = dot(asciiBandTex.rgb, vec3(0.2126, 0.7152, 0.0722));
  float charIndexBand = clamp(floor(lumaBand * (uCharCount.x - 1.0)), 0.0, uCharCount.x - 1.0);
  vec2 asciiUVBand = vec2(
    (charIndexBand + asciiCellUV.x) / uCharCount.x,
    asciiCellUV.y
  );
  float characterBand = texture2D(uAsciiTexture, asciiUVBand).r;
  
  vec3 charColor = uBlueWhiteMode ? vec3(1.0) : vec3(1.0) * (lumaBand + 0.01);
  vec3 fg = characterBand * charColor;
  vec3 bgColor = uBlueWhiteMode ? uBlueColor : vec3(0.0);
  float alpha = characterBand;
  vec4 finalAsciiColor = vec4(mix(bgColor, fg, characterBand), alpha);
  
  /* --------------------------------------------------
     Reveal animation (top-to-bottom)
  -------------------------------------------------- */
  float distortedPos;
  float reveal = revealMask(uProgress, pixelUV, distortedPos);

  float progress = (1.0 + uRevealHeight) - (uProgress * (1.0 + uRevealHeight + uRevealHeight));

  float band = reveal;
  
  // Use distortedPos instead of pixelUV.y for the cutoff
  float passed = step(progress, distortedPos);

  // Rest remains the same
  float tex1Mask = 1.0 - max(band, passed);
  float asciiMask = band;
  float tex2Mask = max(band, passed) - asciiMask;

  /* --------------------------------------------------
     FINAL OUTPUT
  -------------------------------------------------- */
  // Mode 0: single texture revealed with ASCII band
  vec4 tex0 = tex * step(progress, distortedPos);
  vec4 mode0Color = mix(tex0, finalAsciiColor, reveal);

  // Mode 1: two textures transitioning through an ASCII band
  vec4 mode1Color = tex * tex1Mask + finalAsciiColor * asciiMask + tex2 * tex2Mask;

  vec4 finalColor = mix(mode0Color, mode1Color, uMode);

  // ASCII-only override — float(bool) gives 0.0/1.0, no branch needed
  finalColor = mix(finalColor, finalAsciiColor, float(uShowAsciiOnly));

  finalColor.a *= uAlpha;

  gl_FragColor = finalColor;
}