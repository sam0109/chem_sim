// ==============================================================
// Non-bonded force compute shader (LJ + Wolf Coulomb)
//
// Each invocation computes forces on atom i from ALL other atoms j
// (full-shell approach). Energy is only counted for j > i to avoid
// double-counting.
//
// This is O(N) work per invocation, O(N^2) total — same as the
// CPU brute-force path but massively parallelized across GPU cores.
//
// The shader implements:
//   - LJ 12-6 with shifted cutoff: V(r) - V(rc)
//   - Wolf DSF Coulomb with damped erfc
//   - 1-2/1-3 pair exclusions via binary search
//   - 1-4 pair scaling via binary search
//   - Optional PBC minimum image convention
//
// Full-shell is chosen over half-shell because WGSL lacks f32
// atomicAdd, and integer-atomic force accumulation would lose
// precision. Full-shell doubles pair evaluations but each thread
// writes only to its own force output — no atomics needed.
//
// References:
//   LJ: V(r) = 4eps[(sig/r)^12 - (sig/r)^6], shifted at rc
//   Wolf DSF: Fennell & Gezelter, J. Chem. Phys. 124, 234104 (2006)
//   erfc: Numerical Recipes 3rd ed., sec 6.2 (Press et al., 2007)
// ==============================================================

/**
 * Returns the WGSL shader source code for non-bonded force computation.
 *
 * The shader is returned as a string rather than imported as a .wgsl file
 * because the workgroup size needs to be compiled in as a constant.
 *
 * @param workgroupSize Number of threads per workgroup
 */
export function getNonbondedShaderSource(workgroupSize: number): string {
  return /* wgsl */ `
// ================================================================
// Uniforms — matches the CPU-side UNIFORM_BUFFER_SIZE layout
// ================================================================
struct Uniforms {
  nAtoms:          u32,
  cutoff:          f32,
  cutoff2:         f32,
  boxX:            f32,
  boxY:            f32,
  boxZ:            f32,
  usePBC:          u32,
  wolfAlpha:       f32,
  wolfErfcOverRc:  f32,
  wolfForceShift:  f32,
  scale14:         f32,
  nExclusions:     u32,
  nScale14:        u32,
  _pad1:           u32,
  _pad2:           u32,
  _pad3:           u32,
};

// ================================================================
// Bindings
// ================================================================
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> positions:    array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> charges:      array<f32>;
@group(0) @binding(3) var<storage, read> atomTypes:    array<u32>;
@group(0) @binding(4) var<storage, read> ljParams:     array<vec2<f32>>;
@group(0) @binding(5) var<storage, read> exclusions:   array<u32>;
@group(0) @binding(6) var<storage, read> scale14Pairs: array<u32>;
@group(0) @binding(7) var<storage, read_write> forcesOut: array<vec4<f32>>;
@group(0) @binding(8) var<storage, read_write> energyOut: array<vec2<f32>>;

// ================================================================
// Constants
// ================================================================

// Coulomb constant KE = 14.3996 eV*Angstrom/e^2
// Source: NIST CODATA 2018
const KE: f32 = 14.3996;

// 2/sqrt(pi) for Wolf Gaussian damping term
const TWO_OVER_SQRT_PI: f32 = 1.1283791671;

// ================================================================
// erfc approximation — Horner-form rational approximation
// Max absolute error < 1.2e-7 for all x
// Reference: Press et al., "Numerical Recipes" 3rd ed. (2007), sec 6.2
// ================================================================
fn erfc_approx(x: f32) -> f32 {
  let ax = abs(x);
  let t = 1.0 / (1.0 + 0.5 * ax);

  let tau = t * exp(
    -ax * ax
    - 1.26551223
    + t * (1.00002368
    + t * (0.37409196
    + t * (0.09678418
    + t * (-0.18628806
    + t * (0.27886807
    + t * (-1.13520398
    + t * (1.48851587
    + t * (-0.82215223
    + t * 0.17087277))))))))
  );

  if (x < 0.0) {
    return 2.0 - tau;
  }
  return tau;
}

// ================================================================
// Binary search in a sorted u32 array
// Returns true if key is found in arr[0..count-1]
// ================================================================
fn binarySearchExcl(count: u32, key: u32) -> bool {
  if (count == 0u) { return false; }
  var lo: u32 = 0u;
  var hi: u32 = count;
  loop {
    if (lo >= hi) { break; }
    let mid = (lo + hi) >> 1u;
    let val = exclusions[mid];
    if (val == key) { return true; }
    if (val < key) { lo = mid + 1u; }
    else { hi = mid; }
  }
  return false;
}

fn binarySearch14(count: u32, key: u32) -> bool {
  if (count == 0u) { return false; }
  var lo: u32 = 0u;
  var hi: u32 = count;
  loop {
    if (lo >= hi) { break; }
    let mid = (lo + hi) >> 1u;
    let val = scale14Pairs[mid];
    if (val == key) { return true; }
    if (val < key) { lo = mid + 1u; }
    else { hi = mid; }
  }
  return false;
}

// ================================================================
// Minimum image convention for periodic boundaries
// Reference: Allen & Tildesley, Ch 1.5.2
// ================================================================
fn minimumImage(d: f32, boxLen: f32) -> f32 {
  return d - boxLen * round(d / boxLen);
}

// ================================================================
// Encode a pair (i, j) for exclusion lookup
// Convention: smaller index in upper 16 bits
// ================================================================
fn encodePair(a: u32, b: u32) -> u32 {
  let lo = min(a, b);
  let hi = max(a, b);
  return (lo << 16u) | hi;
}

// ================================================================
// Workgroup-shared energy accumulators (integer atomics)
// We scale float energies by 1e6, accumulate as i32, convert back.
// Precision: ~6 significant digits, sufficient for MD energies.
// ================================================================
var<workgroup> wgLjEnergy:   atomic<i32>;
var<workgroup> wgCoulEnergy: atomic<i32>;

const ENERGY_SCALE: f32     = 1000000.0;
const ENERGY_INV_SCALE: f32 = 0.000001;

// ================================================================
// Main compute kernel — full-shell approach
//
// Each invocation handles atom i, looping over ALL j != i.
// Forces are accumulated locally (no atomics needed).
// Energy only counted for j > i to avoid double-counting.
// ================================================================
@compute @workgroup_size(${workgroupSize})
fn main(
  @builtin(global_invocation_id) gid: vec3<u32>,
  @builtin(local_invocation_index) lid: u32,
  @builtin(workgroup_id) wid: vec3<u32>,
) {
  let i = gid.x;
  let nAtoms = u.nAtoms;

  // Initialize workgroup energy accumulators
  if (lid == 0u) {
    atomicStore(&wgLjEnergy, 0);
    atomicStore(&wgCoulEnergy, 0);
  }
  workgroupBarrier();

  if (i >= nAtoms) {
    // Padding threads still participate in the final barrier
    workgroupBarrier();
    if (lid == 0u) {
      let ljE = f32(atomicLoad(&wgLjEnergy)) * ENERGY_INV_SCALE;
      let coulE = f32(atomicLoad(&wgCoulEnergy)) * ENERGY_INV_SCALE;
      energyOut[wid.x] = vec2<f32>(ljE, coulE);
    }
    return;
  }

  let posI = positions[i];
  let qI = charges[i];
  let typeI = atomTypes[i];

  // Compute nTypes from LJ param array length (nTypes^2 entries)
  let ljLen = arrayLength(&ljParams);
  var nTypes: u32 = 1u;
  loop {
    if ((nTypes + 1u) * (nTypes + 1u) > ljLen) { break; }
    nTypes = nTypes + 1u;
  }

  var localFx: f32 = 0.0;
  var localFy: f32 = 0.0;
  var localFz: f32 = 0.0;
  var localLjE: f32 = 0.0;
  var localCoulE: f32 = 0.0;

  for (var j: u32 = 0u; j < nAtoms; j = j + 1u) {
    if (j == i) { continue; }

    // Displacement vector: j - i
    var dx = positions[j].x - posI.x;
    var dy = positions[j].y - posI.y;
    var dz = positions[j].z - posI.z;

    // PBC minimum image
    if (u.usePBC != 0u) {
      dx = minimumImage(dx, u.boxX);
      dy = minimumImage(dy, u.boxY);
      dz = minimumImage(dz, u.boxZ);
    }

    let r2 = dx * dx + dy * dy + dz * dz;

    // Cutoff and overlap check
    if (r2 > u.cutoff2 || r2 < 1e-10) { continue; }

    // Exclusion check (1-2 and 1-3 bonded pairs)
    let pairKey = encodePair(i, j);
    if (binarySearchExcl(u.nExclusions, pairKey)) { continue; }

    // 1-4 scaling check
    let is14 = binarySearch14(u.nScale14, pairKey);
    let scaleFactor = select(1.0, u.scale14, is14);

    // ---- LJ 12-6 force ----
    let typeJ = atomTypes[j];
    let ljIdx = typeI * nTypes + typeJ;
    let ljP = ljParams[ljIdx]; // .x = sigma, .y = epsilon
    let sigma = ljP.x;
    let epsilon = ljP.y * scaleFactor;

    let s2 = sigma * sigma;
    let sr2 = s2 / r2;
    let sr6 = sr2 * sr2 * sr2;
    let sr12 = sr6 * sr6;

    // Shifted cutoff energy: V(r) - V(rc)
    let src2 = s2 / u.cutoff2;
    let src6 = src2 * src2 * src2;
    let src12 = src6 * src6;

    // Only count energy for j > i (avoid double-counting)
    if (j > i) {
      localLjE += 4.0 * epsilon * (sr12 - sr6 - src12 + src6);
    }

    // Force magnitude: F = 24eps/r^2 * [2(sig/r)^12 - (sig/r)^6]
    let ljFMag = (24.0 * epsilon * (2.0 * sr12 - sr6)) / r2;

    // ---- Wolf DSF Coulomb ----
    let qJ = charges[j];
    let qIqJ = qI * scaleFactor * qJ;
    var coulFMag: f32 = 0.0;

    if (abs(qIqJ) > 1e-10) {
      let r = sqrt(r2);
      let invR = 1.0 / r;
      let alphaR = u.wolfAlpha * r;
      let erfcAlphaR = erfc_approx(alphaR);
      let expAlphaR2 = exp(-alphaR * alphaR);

      // DSF energy (only for j > i)
      if (j > i) {
        localCoulE += KE * qIqJ * (
          erfcAlphaR * invR
          - u.wolfErfcOverRc
          + u.wolfForceShift * (r - u.cutoff)
        );
      }

      // DSF force scalar / r
      let fScalar = KE * qIqJ * (
        erfcAlphaR * invR * invR
        + TWO_OVER_SQRT_PI * u.wolfAlpha * expAlphaR2 * invR
        - u.wolfForceShift
      );
      coulFMag = fScalar * invR;
    }

    // Combined force on atom i from atom j
    // F_i = -gradient_i V = -(dV/dr)(r_vec/r)
    // The force functions give F_ij magnitude along r_ij = pos_j - pos_i
    // Force on i: f_i -= F * r_ij (attractive toward j for positive F)
    let fTotal = ljFMag + coulFMag;
    localFx -= fTotal * dx;
    localFy -= fTotal * dy;
    localFz -= fTotal * dz;
  }

  // Write per-atom force (no atomics needed — each thread writes its own)
  forcesOut[i] = vec4<f32>(localFx, localFy, localFz, 0.0);

  // Accumulate energy into workgroup totals using i32 atomics
  let iLjE = i32(round(localLjE * ENERGY_SCALE));
  let iCoulE = i32(round(localCoulE * ENERGY_SCALE));
  atomicAdd(&wgLjEnergy, iLjE);
  atomicAdd(&wgCoulEnergy, iCoulE);

  workgroupBarrier();

  // Thread 0 writes workgroup energy to global output
  if (lid == 0u) {
    let ljE = f32(atomicLoad(&wgLjEnergy)) * ENERGY_INV_SCALE;
    let coulE = f32(atomicLoad(&wgCoulEnergy)) * ENERGY_INV_SCALE;
    energyOut[wid.x] = vec2<f32>(ljE, coulE);
  }
}
`;
}
