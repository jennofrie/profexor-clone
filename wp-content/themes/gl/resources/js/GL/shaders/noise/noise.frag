precision highp float;

uniform float uFlickerSpeed;
uniform float uTime;
uniform float uDensity;
uniform float uSpeed;
uniform float uOpacity;
uniform float uScale;
uniform float uProgress;
uniform float uBlackIntensity;
uniform float uMin;
uniform float uMax;
uniform vec2 uResolution;
uniform float uScrollY;
uniform sampler2D uAsciiTexture;
uniform vec2 uCharCount;
uniform float uAsciiPixelSize;

varying vec2 vUv;

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float cellMask(vec2 fpos, vec2 ipos) {
    float n = random(ipos + floor(fpos * 4.0));
    return step(0.3, n);
}

float loopTime(float t, float period) {
    return sin(t * 6.28318 / period) * 0.5 + 0.5;
}

float flickerTime(vec2 seed, float time, float speed) {
    float t = time * speed;
    float frame = floor(t);
    float jitter = random(seed + frame);
    return frame + jitter;
}

float flickerMask(vec2 fpos, vec2 ipos, float time) {
    vec2 sub = floor(fpos * 5.0);
    float t = flickerTime(ipos * 17.3 + sub * 3.1, time, uFlickerSpeed);
    float n = random(vec2(t, dot(ipos + sub, vec2(7.1, 3.9))));
    return step(1.0 - uBlackIntensity, n);
}

void main() {
    // Snap to ASCII cell grid (screen space, not scroll-affected)
    vec2 normalizedPixelSize = uAsciiPixelSize / uResolution;
    vec2 uvCell = normalizedPixelSize * floor(vUv / normalizedPixelSize);
    vec2 uvCellCenter = uvCell + normalizedPixelSize * 0.5;
    vec2 cellUV = fract(vUv / normalizedPixelSize);

    // Noise coordinates sampled at ASCII cell center (scroll-aware, aspect-correct)
    float scrolledY = (uvCellCenter.y * uResolution.y - uScrollY) / uResolution.x;
    vec2 st = vec2(uvCellCenter.x, scrolledY) * uScale;
    vec2 ipos = floor(st);
    vec2 fpos = fract(st);

    // Circle progress mask
    float dist = distance(uvCellCenter, vec2(0.5));
    float circleMask = step(dist, uProgress);

    float macro = random(floor(vec2(uvCellCenter.x, scrolledY) * 6.0));
    float density = uDensity * 0.001 * uProgress;

    float cellSeed = random(ipos * 7.3);
    float cycleSpeed = uSpeed * 5.0;
    float life = fract(uTime * cycleSpeed + cellSeed);
    float cycle = floor(uTime * cycleSpeed + cellSeed);

    float isActive = 0.0;
    if (density > 0.0) {
        isActive = step(random(ipos * 100.0 + cycle * 13.7), density) * step(0.6, macro);
        isActive *= circleMask;
    }

    // Compute brightness at the ASCII cell center
    float brightness = 0.0;
    if (isActive > 0.0) {
        float appearT = clamp(life / 0.25, 0.0, 1.0);
        float disappearT = clamp((life - 0.75) / 0.25, 0.0, 1.0);
        float wipeMask = step(fpos.x, appearT) * step(disappearT, fpos.x);

        float cellSize = mix(uMin, uMax, random(ipos + 9.3));
        vec2 centered = abs(fpos - 0.5);
        float sizeMask = step(max(centered.x, centered.y), cellSize * 0.5);

        if (sizeMask > 0.0) {
            float cellTime = loopTime(uTime + random(ipos) * 10.0, 2.0);
            float micro = random(ipos * 50.0 + fpos * 0.0001 + cellTime * 0.001);
            float mask = cellMask(fpos, ipos);
            micro *= mask;
            brightness = pow(micro, 0.5) * 0.9 + 0.1;
            brightness *= flickerMask(fpos, ipos, uTime);
            brightness *= wipeMask;
        }
    }

    // Map brightness to ASCII character
    float charIndex = clamp(
        floor(brightness * (uCharCount.x - 1.0)),
        0.0,
        uCharCount.x - 1.0
    );

    vec2 asciiUV = vec2(
        (charIndex + cellUV.x) / uCharCount.x,
        cellUV.y
    );

    float character = texture2D(uAsciiTexture, asciiUV).r;

    gl_FragColor = vec4(1.0, 1.0, 1.0, character * uOpacity);
}
