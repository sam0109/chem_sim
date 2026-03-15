// ==============================================================
// Challenge evaluator — pure measurement functions
//
// These functions compute geometric properties from flat position
// arrays. They are pure (no store/UI imports) and can be tested
// independently. All distances in Å, all angles in degrees.
// ==============================================================

/**
 * Compute the Euclidean distance between two atoms.
 *
 * @param positions - Flat Float64Array [x0,y0,z0,x1,y1,z1,...]
 * @param atomA - Index of first atom
 * @param atomB - Index of second atom
 * @returns Distance in Å
 */
export function measureBondLength(
  positions: Float64Array,
  atomA: number,
  atomB: number,
): number {
  const ax = positions[atomA * 3];
  const ay = positions[atomA * 3 + 1];
  const az = positions[atomA * 3 + 2];
  const bx = positions[atomB * 3];
  const by = positions[atomB * 3 + 1];
  const bz = positions[atomB * 3 + 2];
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Compute the bond angle A-center-C in degrees.
 *
 * Uses the dot product formula:
 *   cos(θ) = (rCA · rCC) / (|rCA| · |rCC|)
 * where rCA = posA - posCenter, rCC = posC - posCenter.
 *
 * @param positions - Flat Float64Array [x0,y0,z0,x1,y1,z1,...]
 * @param atomA - Index of first terminal atom
 * @param atomCenter - Index of central atom
 * @param atomC - Index of second terminal atom
 * @returns Angle in degrees [0, 180]
 */
export function measureBondAngle(
  positions: Float64Array,
  atomA: number,
  atomCenter: number,
  atomC: number,
): number {
  // Vectors from center to A and center to C
  const cax = positions[atomA * 3] - positions[atomCenter * 3];
  const cay = positions[atomA * 3 + 1] - positions[atomCenter * 3 + 1];
  const caz = positions[atomA * 3 + 2] - positions[atomCenter * 3 + 2];

  const ccx = positions[atomC * 3] - positions[atomCenter * 3];
  const ccy = positions[atomC * 3 + 1] - positions[atomCenter * 3 + 1];
  const ccz = positions[atomC * 3 + 2] - positions[atomCenter * 3 + 2];

  const dot = cax * ccx + cay * ccy + caz * ccz;
  const magA = Math.sqrt(cax * cax + cay * cay + caz * caz);
  const magC = Math.sqrt(ccx * ccx + ccy * ccy + ccz * ccz);

  if (magA === 0 || magC === 0) return 0;

  // Clamp to [-1, 1] to avoid NaN from floating point imprecision
  const cosTheta = Math.max(-1, Math.min(1, dot / (magA * magC)));
  return (Math.acos(cosTheta) * 180) / Math.PI;
}
