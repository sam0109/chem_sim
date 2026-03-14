// Impostor cylinder vertex shader
// Renders bonds as view-aligned quads ray-cast into cylinders

attribute vec3 aStart;   // bond start position (world)
attribute vec3 aEnd;     // bond end position (world)
attribute vec3 aColorA;  // color at start
attribute vec3 aColorB;  // color at end
attribute float aRadiusA;
attribute float aBondOrder; // 1, 2, or 3

varying vec3 vColorA;
varying vec3 vColorB;
varying vec2 vUV;
varying vec3 vViewStart;
varying vec3 vViewEnd;
varying float vBondOrder;
varying float vCylinderRadius;

uniform float uBondRadius; // base cylinder radius

void main() {
  vColorA = aColorA;
  vColorB = aColorB;
  vUV = position.xy; // quad: (-1, 0) to (1, 1)
  vBondOrder = aBondOrder;
  vCylinderRadius = uBondRadius;

  // Transform endpoints to view space
  vec4 viewStart = modelViewMatrix * vec4(aStart, 1.0);
  vec4 viewEnd = modelViewMatrix * vec4(aEnd, 1.0);
  
  vViewStart = viewStart.xyz;
  vViewEnd = viewEnd.xyz;

  // Build a view-aligned quad along the bond axis
  vec3 axis = viewEnd.xyz - viewStart.xyz;
  float bondLength = length(axis);
  vec3 dir = axis / max(bondLength, 0.001);
  
  // Perpendicular in view space (cross with view direction)
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  vec3 perp = normalize(cross(dir, viewDir));
  
  // If bond is parallel to view, use alternate perpendicular
  if (length(perp) < 0.001) {
    perp = normalize(cross(dir, vec3(0.0, 1.0, 0.0)));
  }

  // Expand quad
  float radius = uBondRadius * 1.5; // extra padding for antialiasing
  vec3 pos = mix(viewStart.xyz, viewEnd.xyz, position.y);
  pos += perp * position.x * radius;
  // Push slightly toward camera for depth
  pos.z += radius;

  gl_Position = projectionMatrix * vec4(pos, 1.0);
}
