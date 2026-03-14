// Impostor sphere vertex shader
// Renders atoms as billboarded quads that are ray-cast
// into perfect spheres in the fragment shader

uniform float uScale; // global scale factor

attribute float aRadius;
attribute vec3 aColor;
attribute float aSelected; // 1.0 if selected

varying vec3 vColor;
varying vec2 vUV;
varying float vRadius;
varying vec3 vViewPosition;
varying float vSelected;

void main() {
  vColor = aColor;
  vUV = position.xy; // quad corners: (-1,-1), (1,-1), (1,1), (-1,1)
  vRadius = aRadius * uScale;
  vSelected = aSelected;

  // Billboard: expand quad in view space
  vec4 mvPosition = modelViewMatrix * vec4(instanceMatrix[3].xyz, 1.0);
  
  // Offset by quad position scaled by radius
  mvPosition.xy += position.xy * vRadius;
  
  vViewPosition = mvPosition.xyz;
  
  gl_Position = projectionMatrix * mvPosition;
}
