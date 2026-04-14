uniform float uStripeCount;
uniform float uStripeThickness;

varying vec2 vUv;

void main() {
  float pattern = fract(vUv.y * uStripeCount);
  
  // Determine if pixel is in stripe or background
  float stripe = step(1.0 - uStripeThickness, pattern);
  
  // Black background, white stripes
  // vec3 color = vec3(stripe);
  vec3 color = vec3(1.);

  gl_FragColor = vec4(color, 1.);
}

// uniform vec2 uResolution; // Screen resolution (width, height)
// // uniform float uPixelSize; // Size of pixels (e.g., 10.0, 20.0, 50.0)
// // uniform float uPixelGap; // Gap between pixels 0.0-1.0 (e.g., 0.1 = 10% gap)

// varying vec2 vUv;

// void main() {
//   float uPixelSize = 50.;
//   float uPixelGap = 0.;

//   // Calculate which pixel we're in
//   vec2 pixelCoord = floor(vUv * uResolution / uPixelSize);
  
//   // Calculate position within the pixel (0.0 to 1.0)
//   vec2 pixelUv = fract(vUv * uResolution / uPixelSize);
  
//   // Create gaps between pixels
//   float isInPixel = step(uPixelGap, pixelUv.x) * step(uPixelGap, pixelUv.y);
//   isInPixel *= step(pixelUv.x, 1.0 - uPixelGap) * step(pixelUv.y, 1.0 - uPixelGap);
  
//   // White pixels with black gaps
//   vec3 color = vec3(isInPixel);
  
//   gl_FragColor = vec4(color, 1.0);
// }