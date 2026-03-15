// Debug: run with npx tsx src/engine/debug.ts
import elements from '../data/elements';
import { getMorseBondParams, getLJParams, getUFFAngleK } from '../data/uff';
import { morseBondForce } from './forces/morse';
import { ljForce } from './forces/lennardJones';
import { coulombForce } from './forces/coulomb';
import { harmonicAngleForce } from './forces/harmonic';
import { pauliRepulsion } from './forces/pauli';
import { detectBonds, buildAngleList } from './bondDetector';
import { velocityVerletStep, initializeVelocities, computeTemperature } from './integrator';
import { berendsenThermostat } from './thermostat';

function debugWater(): void {
  console.log('=== WATER SIMULATION TEST ===\n');
  const re = 0.990;
  const ha = (104.51 / 2) * Math.PI / 180;
  const hx = re * Math.sin(ha);
  const hy = re * Math.cos(ha);
  const Z = [8, 1, 1];
  const N = 3;
  const chg = [-0.8476, 0.4238, 0.4238];
  const M = new Float64Array([15.999, 1.008, 1.008]);
  const fix = new Uint8Array(3);

  const { kAngle: ak } = getUFFAngleK(1, 8, 1);
  console.log('UFF angle K(H-O-H): ' + ak.toFixed(3) + ' eV/rad^2');

  const pos = new Float64Array([0, 0, 0, hx, hy, 0, -hx, hy, 0]);
  const vel = new Float64Array(9);
  const frc = new Float64Array(9);
  initializeVelocities(vel, M, fix, 300);

  // Topology state
  let bonds: ReturnType<typeof detectBonds> = [];
  let angs: Array<[number, number, number]> = [];
  const excl = new Set<string>();
  let bp: Array<{ i: number; j: number; De: number; alpha: number; re: number }> = [];
  let ap: Array<{ i: number; j: number; k: number; kA: number; t0: number }> = [];

  function rebuildTopo(): void {
    bonds = detectBonds(pos, Z, 1.2, bonds, 1.5);
    angs = buildAngleList(bonds, N);
    excl.clear();
    bp = [];
    ap = [];
    for (const b of bonds) {
      excl.add(Math.min(b.atomA, b.atomB) + '-' + Math.max(b.atomA, b.atomB));
      if (b.type === 'hydrogen' || b.type === 'vanderwaals') continue;
      const p = getMorseBondParams(Z[b.atomA], Z[b.atomB], b.order);
      bp.push({ i: b.atomA, j: b.atomB, ...p });
    }
    for (const [i, , k] of angs) {
      excl.add(Math.min(i, k) + '-' + Math.max(i, k));
    }
    for (const [ti, c, tk] of angs) {
      const a = getUFFAngleK(Z[ti], Z[c], Z[tk]);
      ap.push({ i: ti, j: c, k: tk, kA: a.kAngle, t0: a.theta0 });
    }
  }

  // Force function (topology is FIXED during integration)
  function calcForces(p: Float64Array, f: Float64Array): number {
    let pe = 0;
    for (const b of bp) pe += morseBondForce(p, f, b.i, b.j, b.De, b.alpha, b.re);
    for (const a of ap) pe += harmonicAngleForce(p, f, a.i, a.j, a.k, a.kA, a.t0);
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        if (excl.has(i + '-' + j)) continue;
        const lj = getLJParams(Z[i], Z[j]);
        pe += ljForce(p, f, i, j, lj.sigma, lj.epsilon, 10);
        pe += coulombForce(p, f, i, j, chg[i], chg[j], 10);
      }
    }
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const ri = elements[Z[i]];
        const rj = elements[Z[j]];
        const rm = 0.5 * Math.min(ri.covalentRadius, rj.covalentRadius);
        pe += pauliRepulsion(p, f, i, j, Math.max(rm, 0.15), 20);
      }
    }
    return pe;
  }

  // Init
  rebuildTopo();

  // --- Numerical gradient check on angle force ---
  console.log('\n--- NUMERICAL GRADIENT CHECK ---');
  const h = 1e-5;
  const testFrc = new Float64Array(9);
  testFrc.fill(0);
  calcForces(new Float64Array(pos), testFrc);
  console.log('Analytical forces:');
  for (let ai = 0; ai < N; ai++) {
    console.log('  ' + elements[Z[ai]].symbol + ': [' + testFrc[ai*3].toFixed(6) + ', ' + testFrc[ai*3+1].toFixed(6) + ', ' + testFrc[ai*3+2].toFixed(6) + ']');
  }
  console.log('Numerical forces (-dE/dx central diff):');
  for (let ai = 0; ai < N; ai++) {
    const numF = [0, 0, 0];
    for (let d = 0; d < 3; d++) {
      const p1 = new Float64Array(pos); p1[ai*3+d] += h;
      const p2 = new Float64Array(pos); p2[ai*3+d] -= h;
      const f1 = new Float64Array(9); const f2 = new Float64Array(9);
      const e1 = calcForces(p1, f1);
      const e2 = calcForces(p2, f2);
      numF[d] = -(e1 - e2) / (2 * h);
    }
    const err = Math.sqrt((numF[0]-testFrc[ai*3])**2 + (numF[1]-testFrc[ai*3+1])**2 + (numF[2]-testFrc[ai*3+2])**2);
    console.log('  ' + elements[Z[ai]].symbol + ': [' + numF[0].toFixed(6) + ', ' + numF[1].toFixed(6) + ', ' + numF[2].toFixed(6) + '] err=' + err.toExponential(3));
  }

  frc.fill(0);
  calcForces(pos, frc);

  let minAng = 999, maxAng = 0, minHH = 999;
  let hhDetected = false;
  const STEPS_PER_FRAME = 5;
  const TOTAL_STEPS = 6000;

  for (let s = 0; s < TOTAL_STEPS; s++) {
    const r = velocityVerletStep(pos, vel, frc, M, fix, 0.1, calcForces);

    // Berendsen thermostat
    berendsenThermostat(vel, M, fix, r.kineticEnergy, 300, 0.5, 100);

    // Rebuild topology every STEPS_PER_FRAME steps
    if ((s + 1) % STEPS_PER_FRAME === 0) {
      // Uncomment to disable: rebuildTopo();
      rebuildTopo();
    }

    // Measure
    const dx1 = pos[3] - pos[0], dy1 = pos[4] - pos[1], dz1 = pos[5] - pos[2];
    const dx2 = pos[6] - pos[0], dy2 = pos[7] - pos[1], dz2 = pos[8] - pos[2];
    const r1 = Math.sqrt(dx1 * dx1 + dy1 * dy1 + dz1 * dz1);
    const r2 = Math.sqrt(dx2 * dx2 + dy2 * dy2 + dz2 * dz2);
    const ct = (dx1 * dx2 + dy1 * dy2 + dz1 * dz2) / (r1 * r2);
    const ang = Math.acos(Math.max(-1, Math.min(1, ct))) * 180 / Math.PI;
    const dHH = Math.sqrt((pos[6] - pos[3]) ** 2 + (pos[7] - pos[4]) ** 2 + (pos[8] - pos[5]) ** 2);
    const T = computeTemperature(r.kineticEnergy, N);

    minAng = Math.min(minAng, ang);
    maxAng = Math.max(maxAng, ang);
    minHH = Math.min(minHH, dHH);

    const hh = bonds.find(b => Z[b.atomA] === 1 && Z[b.atomB] === 1);
    if (hh) hhDetected = true;

    if (s < 10 || s % 300 === 0) {
      console.log(
        '  ' + String(s).padStart(4) +
        ': ang=' + ang.toFixed(1) +
        ' HH=' + dHH.toFixed(3) +
        ' OH1=' + r1.toFixed(3) +
        ' OH2=' + r2.toFixed(3) +
        ' T=' + T.toFixed(0) + 'K' +
        ' E=' + (r.kineticEnergy + r.potentialEnergy).toFixed(4) +
        ' bonds=' + bonds.length +
        (hh ? ' HH!' : '')
      );
    }
  }

  console.log('\n  Angle: ' + minAng.toFixed(1) + '-' + maxAng.toFixed(1) + ' deg');
  console.log('  Min H-H: ' + minHH.toFixed(3) + ' A');
  console.log('  H-H bond: ' + (hhDetected ? 'YES BUG' : 'NO OK'));
}

debugWater();
