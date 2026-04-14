    varying vec3 vColor;
    varying vec3 vPos;
    varying float vAlpha;
    varying float vDelay;
    varying float vLight;

    uniform float uProgress;

    void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        float alpha = 1.0 - smoothstep(0.4, 0.5, d);
        
        float fadeDuration = 0.15;
        float localProgress = (vAlpha - vDelay) / fadeDuration;
        float appear = smoothstep(0.0, 1.0, localProgress);

        alpha *= appear;
        alpha *= vLight;

        if (alpha < 0.01) discard;

        gl_FragColor = vec4(vColor, alpha);
    }