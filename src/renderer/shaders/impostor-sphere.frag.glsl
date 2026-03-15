// Impostor sphere fragment shader
// Ray-casts a perfect sphere from a billboarded quad
// Writes correct depth for proper intersection with other geometry

// Three.js injects projectionMatrix into the vertex shader prefix but NOT
// the fragment shader prefix. We need it here for gl_FragDepth correction,
// so declare it explicitly.
uniform mat4 projectionMatrix;

uniform vec3 uLightDir;
uniform vec3 uAmbient;
uniform float uShininess;

varying vec3 vColor;
varying vec2 vUV;
varying float vRadius;
varying vec3 vViewPosition;
varying float vSelected;

void main() {
  // Ray-sphere intersection in view space
  // The sphere center is at vViewPosition (when vUV = 0,0)
  // The fragment is at vViewPosition + (vUV * vRadius, 0) with offset in xy
  
  float r2 = dot(vUV, vUV);
  
  // Discard fragments outside the sphere silhouette
  if (r2 > 1.0) discard;
  
  // Compute z-component of normal on sphere surface
  float z = sqrt(1.0 - r2);
  
  // Normal in view space (billboard-aligned)
  vec3 normal = vec3(vUV, z);
  
  // Sphere surface point in view space
  vec3 surfacePoint = vViewPosition + vec3(0.0, 0.0, z * vRadius);
  
  // Write correct depth
  vec4 clipPos = projectionMatrix * vec4(surfacePoint, 1.0);
  float ndcDepth = clipPos.z / clipPos.w;
  gl_FragDepth = (ndcDepth + 1.0) * 0.5;
  
  // Lighting: Blinn-Phong
  vec3 lightDir = normalize(uLightDir);
  
  // Diffuse
  float diff = max(dot(normal, lightDir), 0.0);
  
  // Specular (Blinn-Phong)
  vec3 viewDir = vec3(0.0, 0.0, 1.0); // In view space, camera looks along -z
  vec3 halfDir = normalize(lightDir + viewDir);
  float spec = pow(max(dot(normal, halfDir), 0.0), uShininess);
  
  // Final color
  vec3 color = vColor;
  
  // Selection highlight: add a glowing overlay
  if (vSelected > 0.5) {
    color = mix(color, vec3(0.3, 0.7, 1.0), 0.3);
    spec *= 2.0;
  }
  
  vec3 finalColor = uAmbient * color + diff * color + spec * vec3(0.4);
  
  // Rim lighting for depth perception
  float rim = 1.0 - z;
  finalColor += rim * rim * 0.15 * color;
  
  gl_FragColor = vec4(finalColor, 1.0);
}
