// Impostor cylinder fragment shader
// Blinn-Phong shaded cylinder with correct depth output

uniform vec3 uLightDir;
uniform vec3 uAmbient;

varying vec3 vColorA;
varying vec3 vColorB;
varying vec2 vUV;
varying vec3 vViewStart;
varying vec3 vViewEnd;
varying float vBondOrder;
varying float vCylinderRadius;

void main() {
  // vUV.x: -1 to 1 across cylinder width
  // vUV.y: 0 to 1 along bond axis (start to end)

  float x = vUV.x;

  // Discard outside cylinder silhouette
  if (abs(x) > 1.0) discard;

  // For double/triple bonds, check if we're in the gap between cylinders
  if (vBondOrder >= 1.5) {
    float adjustedX = x * vBondOrder;
    float cylIndex = floor(adjustedX + vBondOrder * 0.5);
    float localX = adjustedX - cylIndex + 0.5;
    if (abs(localX - 0.5) > 0.4) discard;
    x = (localX - 0.5) * 2.5;
    if (abs(x) > 1.0) discard;
  }

  // Normal from UV (cylinder)
  float z = sqrt(max(0.0, 1.0 - x * x));

  // Axis direction in view space
  vec3 axis = normalize(vViewEnd - vViewStart);
  vec3 viewDir = vec3(0.0, 0.0, 1.0);

  // Safe perpendicular: check cross product length before normalizing
  // to avoid NaN when bond is parallel to view direction
  vec3 rawPerp = cross(axis, viewDir);
  vec3 perp = length(rawPerp) > 0.001
    ? normalize(rawPerp)
    : normalize(cross(axis, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(perp, axis);

  vec3 normal = normalize(perp * x + up * z);

  // Compute cylinder surface point in view space for correct depth
  vec3 axisPoint = mix(vViewStart, vViewEnd, vUV.y);
  vec3 surfacePoint = axisPoint + (perp * x + up * z) * vCylinderRadius;

  // Write correct depth from cylinder surface (not flat quad)
  vec4 clipPos = projectionMatrix * vec4(surfacePoint, 1.0);
  float ndcDepth = clipPos.z / clipPos.w;
  gl_FragDepth = (ndcDepth + 1.0) * 0.5;

  // Interpolate color along bond
  float t = vUV.y;
  vec3 color = mix(vColorA, vColorB, t);

  // Lighting: Blinn-Phong (shininess 40.0 to match sphere impostor)
  vec3 lightDir = normalize(uLightDir);
  float diff = max(dot(normal, lightDir), 0.0);

  vec3 halfDir = normalize(lightDir + viewDir);
  float spec = pow(max(dot(normal, halfDir), 0.0), 40.0);

  vec3 finalColor = uAmbient * color + diff * color + spec * vec3(0.3);

  gl_FragColor = vec4(finalColor, 1.0);
}
