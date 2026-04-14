uniform vec2 uResolution;
uniform float uSize;
uniform float uVisibility;

uniform sampler2D uParticlesTexture;
uniform sampler2D uNormalsTexture;

attribute vec2 aParticlesUv;
attribute float aSize;

varying vec3 vColor;
varying float vAlpha;
varying vec3 vNormal;

varying float vLight;
varying float vDelay;
varying vec3 vPos;

uniform vec3 uLightDir;

#define PI 3.141592653589793

float hash1(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
}

void main() {
    vec4 particle = texture(uParticlesTexture, aParticlesUv);

    vec4 modelPosition = modelMatrix * vec4(particle.xyz, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;

    vPos = modelPosition.xyz;
    vDelay = hash1(vPos);

    vec3 normalFromTex = texture(uNormalsTexture, aParticlesUv).xyz;
    
    float sizeIn = smoothstep(0., 0.1, particle.a);
    float sizeOut = 1. - smoothstep(0.7, 1., particle.a);
    float size = min(sizeIn, sizeOut);

    gl_Position = projectedPosition;
    gl_PointSize = size * aSize * uSize * uResolution.y;
    gl_PointSize *= (1.0 / - viewPosition.z);

    vColor = vec3(1.0);
    vAlpha = uVisibility;
    vNormal = normalize(normalMatrix * normalFromTex);
    vLight = max(dot(vNormal, uLightDir), 0.);
}