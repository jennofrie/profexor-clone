uniform float uTime;
uniform float uAlpha;
uniform float uScale;
uniform float uDarkness;
uniform float uParallax;
uniform float uVideoEnabled;
uniform float uLoopEnabled;

uniform vec2 uResolution;
uniform vec2 uMeshSize;
uniform vec2 uImageSize;
uniform vec2 uVideoSize;
uniform vec2 uLoopSize;

uniform sampler2D uTexture;
uniform sampler2D uVideoTexture;
uniform sampler2D uLoopTexture;
uniform sampler2D uDataTexture;

varying vec2 vUv;

vec2 aspect(in vec2 size, in float scale) {
  return scale / size;
}

vec2 aspectCover(vec2 uv, vec2 imageSize, vec2 meshSize) {
  vec2 sizeRatio = imageSize / meshSize;
  vec2 newSize = aspect(sizeRatio, min(sizeRatio.x, sizeRatio.y));
  vec2 centeredSize = uv * newSize + (1. - newSize) * 0.5;
  
  return centeredSize;
}

vec3 blendColorBurn(vec3 base, vec3 blend) {
  return 1.0 - (1.0 - base) / (blend + 0.0001);
}

void main() {
  vec2 uv = vUv;

  vec4 offset = texture2D(uDataTexture, vUv);
  uv -= offset.rg * 0.1;

  float uPixelSize = 8.;

  vec2 uvLoopCover = aspectCover(uv, uLoopSize, uMeshSize);
  vec2 uvVideoCover = aspectCover(uv, uVideoSize, uMeshSize);
  vec2 uvCover = aspectCover(uv, uImageSize, uMeshSize);

  uvCover = (uvCover - 0.5) / uScale + 0.5;

  uvCover.y += uParallax;
  uvVideoCover.y += uParallax;

  vec4 tex = texture2D(uTexture, uvCover);
  vec4 videoTex = texture2D(uVideoTexture, uvVideoCover);

  vec4 finalTex = mix(tex, videoTex, uVideoEnabled);

  vec3 color = mix(finalTex.rgb, vec3(0.), uDarkness);

  gl_FragColor = vec4(color.rgb, uAlpha);
}
