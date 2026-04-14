uniform float uTime;
uniform float uDeltaTime;
uniform float uFlowFieldInfluence;
uniform float uFlowFieldStrength;
uniform float uFlowFieldFrequency;
uniform float uVisibility;

uniform vec3 uMouse;
uniform float uMouseRadius;
uniform float uMouseStrength;
uniform float uMouseSpeed;

uniform float uOrbiterEnabled;
uniform float uOrbiterRadius;
uniform float uOrbiterSpread;
uniform float uOrbiterSpeed;
uniform float uOrbiterVertical;
uniform float uOrbiterJitter;
uniform float uOrbiterBlend;
uniform vec3  uOrbiterCenter;

uniform sampler2D uBase;

#include ../includes/simplexNoise4d.glsl
#define PI2 6.283185307179586

vec3 hash3(vec3 p) {
  p = fract(p * vec3(443.897, 441.423, 437.195));
  p += dot(p, p.yxz + 19.19);
  return fract((p.xxy + p.yxx) * p.zyx);
}

void main() {
  float time = uTime * 0.2;
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 particle = texture(uParticles, uv);
  vec4 base = texture(uBase, uv);

  bool isOrbiter = false;

  vec3 explodedPos = (hash3(base.xyz) - 0.5) * 6.0;
  vec3 targetPos = mix(explodedPos, base.xyz, 1.);

  float uRepelStrength = clamp(uMouseSpeed, 0.0, uMouseStrength);
  vec3 particlePos = particle.xyz;
  vec3 mousePos = uMouse;
  vec3 dir = normalize(particlePos - mousePos);
  float dist = distance(mousePos, particlePos);
  float repulsionForce = uRepelStrength / (dist * (dist + 1.0));
  vec3 repulsion = dir * repulsionForce * 2.0;
  particle.xyz += repulsion * uRepelStrength;

  if (isOrbiter) {
    vec3 h = hash3(base.xyz);

    vec2 rand2D = hash3(vec3(uv, 0.0)).xy * 2.0 - 1.0;
    vec3 fullscreenPos = vec3(
        rand2D.x * uOrbiterSpread,
        rand2D.y * uOrbiterSpread,
        (h.z - 0.5) * uOrbiterSpread
    );

    float radius = uOrbiterRadius + h.x * uOrbiterSpread;
    float speed  = uOrbiterSpeed  * (0.5 + h.y);
    float angle  = time * speed + h.z * PI2;

    vec3 orbit = vec3(
        cos(angle),
        sin(angle * 0.7) * uOrbiterVertical,
        sin(angle)
    ) * radius;

    vec3 jitter = vec3(
        simplexNoise4d(vec4(fullscreenPos + 0.0, time)),
        simplexNoise4d(vec4(fullscreenPos + 1.0, time)),
        simplexNoise4d(vec4(fullscreenPos + 2.0, time))
    ) * uOrbiterJitter;

    vec3 orbitTarget = fullscreenPos + orbit + jitter + uOrbiterCenter;

    particle.xyz = mix(particle.xyz, orbitTarget, uOrbiterBlend);
    particle.a = 0.0;
  } else {
    if (particle.a >= 1.0) {
      particle.a = mod(particle.a, 1.0);
      particle.xyz = base.xyz;
    } else {
      float strength = simplexNoise4d(vec4(base.xyz, time + 1.0));
      float influence = (uFlowFieldInfluence - 0.5) * (- 2.0);
      strength = smoothstep(influence, 1.0, strength);

      vec3 flowField = vec3(
        simplexNoise4d(vec4(particle.xyz * uFlowFieldFrequency + 0.0, time)),
        simplexNoise4d(vec4(particle.xyz * uFlowFieldFrequency + 1.0, time)),
        simplexNoise4d(vec4(particle.xyz * uFlowFieldFrequency + 2.0, time))
      );
      flowField = normalize(flowField);
      particle.xyz += flowField * uDeltaTime * strength * uFlowFieldStrength;

      vec3 toTarget = targetPos - particle.xyz;
      float springStrength = 2.0;
      float pullStrength = 0.1;
      particle.xyz += toTarget * springStrength * uDeltaTime;
      particle.xyz += toTarget * uDeltaTime * pullStrength;

      particle.a += uDeltaTime * 0.5;
    }
  }

  gl_FragColor = particle;
}
