// Procedural eukaryotic cell. Every organelle is generated in code; no external models.
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- utilities

// Small deterministic PRNG so the cell looks the same on every load.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function randomUnit(r) {
  const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
  return v3(s * Math.cos(th), u, s * Math.sin(th));
}

function fibonacciSphere(n) {
  const pts = [], g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2, rad = Math.sqrt(1 - y * y), th = g * i;
    pts.push(v3(Math.cos(th) * rad, y, Math.sin(th) * rad));
  }
  return pts;
}

// Merge indexed geometries that share position+normal attributes.
function mergeGeometries(list) {
  let vCount = 0, iCount = 0;
  for (const g of list) {
    vCount += g.attributes.position.count;
    iCount += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(vCount * 3), nor = new Float32Array(vCount * 3);
  const idx = new Uint32Array(iCount);
  let vo = 0, io = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, vo * 3);
    nor.set(g.attributes.normal.array, vo * 3);
    if (g.index) {
      const a = g.index.array;
      for (let i = 0; i < a.length; i++) idx[io + i] = a[i] + vo;
      io += a.length;
    } else {
      for (let i = 0; i < g.attributes.position.count; i++) idx[io + i] = vo + i;
      io += g.attributes.position.count;
    }
    vo += g.attributes.position.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

// A closed, flattened tube that follows a curve. `thinAxis(t)` says which way the
// sheet is thin (e.g. radial for ER wrapped around the nucleus); a(t) is the thin
// half-width, b(t) the wide half-width. Used for ER sheets and Golgi cisternae.
function ribbon({ point, thinAxis, a, b, segments = 120, radial = 18, squareness = 0.55 }) {
  const rows = segments + 1, cols = radial;
  const pos = new Float32Array(rows * cols * 3);
  const T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3();
  const p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), c = new THREE.Vector3();
  const eps = 1e-3;
  for (let i = 0; i < rows; i++) {
    const t = i / segments;
    point(Math.max(0, t - eps), p0);
    point(Math.min(1, t + eps), p1);
    T.subVectors(p1, p0).normalize();
    point(t, c);
    thinAxis(t, c, N);
    N.addScaledVector(T, -N.dot(T)).normalize();
    B.crossVectors(T, N).normalize();
    const ai = a(t), bi = b(t);
    for (let j = 0; j < cols; j++) {
      const u = (j / cols) * Math.PI * 2;
      const cu = Math.cos(u), su = Math.sin(u);
      const x = Math.sign(cu) * Math.pow(Math.abs(cu), squareness);
      const y = Math.sign(su) * Math.pow(Math.abs(su), squareness);
      const k = (i * cols + j) * 3;
      pos[k] = c.x + N.x * x * ai + B.x * y * bi;
      pos[k + 1] = c.y + N.y * x * ai + B.y * y * bi;
      pos[k + 2] = c.z + N.z * x * ai + B.z * y * bi;
    }
  }
  const index = [];
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < cols; j++) {
      const a0 = i * cols + j, a1 = i * cols + ((j + 1) % cols);
      const b0 = a0 + cols, b1 = a1 + cols;
      index.push(a0, b0, a1, a1, b0, b1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

// Tube along a smooth curve through points.
function tube(points, radius, tubular = 48, radialSegs = 7) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  return new THREE.TubeGeometry(curve, tubular, radius, radialSegs, false);
}

function material(color, opts = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.58,
    metalness: 0,
    clearcoat: 0.12,
    clearcoatRoughness: 0.35,
    sheen: 0.45,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color(0xffffff),
    // a little self-light reads as the waxy, light-scattering look of medical renders
    emissive: new THREE.Color(color).multiplyScalar(0.07),
    ...opts,
  });
}

// ---------------------------------------------------------------- shapes

const CELL_ABC = v3(3.45, 2.35, 3.05);

export function membraneRadius(d) {
  const a = CELL_ABC;
  const base = 1 / Math.sqrt((d.x * d.x) / (a.x * a.x) + (d.y * d.y) / (a.y * a.y) + (d.z * d.z) / (a.z * a.z));
  const wobble = 1
    + 0.045 * Math.sin(2.3 * d.x + 0.6) * Math.cos(1.9 * d.y - 0.3)
    + 0.035 * Math.sin(3.1 * d.z + 1.7 * d.x + 0.4)
    + 0.02 * Math.sin(5.0 * d.y + 2.0 * d.z);
  const flat = d.y < -0.55 ? 1 - 0.14 * Math.pow((-d.y - 0.55) / 0.45, 1.5) : 1;
  return base * wobble * flat;
}

const NUC_CENTER = v3(-0.55, 0.12, -0.4);
const NUC_ABC = v3(1.22, 1.05, 1.15);
function nucleusRadius(d, shrink = 0) {
  const a = NUC_ABC;
  const base = 1 / Math.sqrt((d.x * d.x) / (a.x * a.x) + (d.y * d.y) / (a.y * a.y) + (d.z * d.z) / (a.z * a.z));
  return base * (1 + 0.025 * Math.sin(3 * d.x + 2 * d.z)) - shrink;
}

function deformedSphere(center, radiusFn, wSeg = 128, hSeg = 96) {
  const g = new THREE.SphereGeometry(1, wSeg, hSeg);
  const p = g.attributes.position, d = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    d.fromBufferAttribute(p, i).normalize();
    const r = radiusFn(d);
    p.setXYZ(i, center.x + d.x * r, center.y + d.y * r, center.z + d.z * r);
  }
  g.computeVertexNormals();
  return g;
}

// A wedge-shaped cutaway: everything with azimuth (around a vertical axis through
// `center`) inside [phi0 - alpha, phi0 + alpha] is clipped away.
export class Wedge {
  constructor(center, phi0, alpha) {
    this.center = center.clone();
    this.phi0 = phi0;
    this.planes = [new THREE.Plane(), new THREE.Plane()];
    this.set(alpha);
  }
  set(alpha) {
    this.alpha = alpha;
    this.b1 = this.phi0 - alpha;
    this.b2 = this.phi0 + alpha;
    const n1 = v3(Math.sin(this.b1), 0, -Math.cos(this.b1));
    const n2 = v3(-Math.sin(this.b2), 0, Math.cos(this.b2));
    this.planes[0].setFromNormalAndCoplanarPoint(n1, this.center);
    this.planes[1].setFromNormalAndCoplanarPoint(n2, this.center);
  }
  dir(phi) { return v3(Math.cos(phi), 0, Math.sin(phi)); }
}

// The flat face left where a shell is cut along one wedge boundary.
function cutFace(center, outerFn, innerFn, beta, faceNormal, steps = 140) {
  const pos = [], nor = [], idx = [];
  const d = new THREE.Vector3();
  for (let i = 0; i <= steps; i++) {
    const th = 0.002 + (i / steps) * (Math.PI - 0.004);
    d.set(Math.sin(th) * Math.cos(beta), Math.cos(th), Math.sin(th) * Math.sin(beta));
    const ro = outerFn(d), ri = innerFn(d);
    pos.push(center.x + d.x * ro, center.y + d.y * ro, center.z + d.z * ro);
    pos.push(center.x + d.x * ri, center.y + d.y * ri, center.z + d.z * ri);
    nor.push(faceNormal.x, faceNormal.y, faceNormal.z, faceNormal.x, faceNormal.y, faceNormal.z);
  }
  for (let i = 0; i < steps; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  // Normals must agree with the winding or the AO prepass treats the face as back-facing.
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- the cell

export const PALETTE = {
  membrane: 0xd3dee8,
  membraneInner: 0xe9eef3,
  membraneCut: 0xbccbd8,
  nucleus: 0x8d7bc9,
  nucleusInner: 0xb3a5de,
  nucleusCut: 0x6f5cae,
  nucleolus: 0x5e44a6,
  pore: 0x6a55b0,
  rer: 0x9384d6,
  ribosome: 0x3f63d1,
  ser: 0xe6a39b,
  golgiCis: 0xf0dcc6,
  golgiTrans: 0xcf7f7f,
  mito: 0xdf7a76,
  mitoInner: 0xf3b3aa,
  lysosome: 0x3c9a88,
  lysoContent: 0x1f6d5f,
  debris: 0x8a8070,
  peroxisome: 0x88b05a,
  peroxCore: 0x4f7a2c,
  centriole: 0xe6b543,
  microtubule: 0x7fc08e,
  actin: 0xb7865b,
  intermediate: 0xe2d3a3,
  vesicle: 0xd7c7e8,
};

export function buildCell({ lowPower = false } = {}) {
  const group = new THREE.Group();
  const organelles = {};
  const r = rng(20261016);

  const register = (key, obj, anchor) => {
    if (!organelles[key]) organelles[key] = { key, objects: [], materials: new Set(), anchor: null };
    const o = organelles[key];
    obj.userData.organelle = key;
    o.objects.push(obj);
    obj.traverse?.((c) => {
      if (c.material) {
        c.userData.organelle = key;
        (Array.isArray(c.material) ? c.material : [c.material]).forEach((m) => o.materials.add(m));
      }
    });
    if (anchor && !o.anchor) o.anchor = anchor.clone();
    group.add(obj);
    return obj;
  };

  // Two cutaways: one through the cell, one through the nucleus.
  const cellWedge = new Wedge(v3(0, 0, 0), THREE.MathUtils.degToRad(46), THREE.MathUtils.degToRad(54));
  const nucWedge = new Wedge(NUC_CENTER, THREE.MathUtils.degToRad(72), THREE.MathUtils.degToRad(40));
  const clipCell = { clippingPlanes: cellWedge.planes, clipIntersection: true };
  const clipNuc = { clippingPlanes: nucWedge.planes, clipIntersection: true };

  // ---------------- plasma membrane
  const memGeo = deformedSphere(v3(0, 0, 0), membraneRadius, 160, 120);
  const memBack = new THREE.Mesh(memGeo, material(PALETTE.membraneInner, {
    side: THREE.BackSide, roughness: 0.7, sheen: 0.2, clearcoat: 0, ...clipCell,
  }));
  // Frosted-glass skin: real transmission on capable devices, plain translucency otherwise.
  const memFront = new THREE.Mesh(memGeo, lowPower
    ? material(PALETTE.membrane, { side: THREE.FrontSide, transparent: true, opacity: 0.45, depthWrite: false, roughness: 0.22, clearcoat: 0.8, sheen: 0.2, ...clipCell })
    : material(0xe8f0f7, {
      side: THREE.FrontSide, transmission: 0.92, thickness: 0.35, ior: 1.25, roughness: 0.32,
      clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0, attenuationColor: new THREE.Color(0xc9d8e6), attenuationDistance: 2.5,
      emissive: new THREE.Color(0x000000), ...clipCell,
    }));
  memFront.userData.noAO = true;
  memFront.renderOrder = 10;
  memFront.userData.nopick = true;
  const memCutMat = material(PALETTE.membraneCut, { side: THREE.DoubleSide, roughness: 0.6 });
  const memCut = new THREE.Group();
  const membraneGroup = new THREE.Group();
  membraneGroup.add(memBack, memFront, memCut);
  register('membrane', membraneGroup, null);
  organelles.membrane.materials.add(memCutMat);

  // ---------------- microvilli on the apical (top) surface
  {
    const mats = material(PALETTE.membrane, { roughness: 0.35, ...clipCell });
    const geo = new THREE.CapsuleGeometry(0.05, 0.22, 4, 10);
    const pts = fibonacciSphere(900).filter((d) => d.y > 0.84);
    const mesh = new THREE.InstancedMesh(geo, mats, pts.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
    pts.forEach((d, i) => {
      const rr = membraneRadius(d);
      const n = d.clone();
      const len = 0.8 + r() * 0.35;
      q.setFromUnitVectors(UP, n);
      s.set(1, len, 1);
      m.compose(d.clone().multiplyScalar(rr + 0.11 * len - 0.03), q, s);
      mesh.setMatrixAt(i, m);
    });
    // Anchor on microvilli across the top from the cutaway, which stay visible.
    const az = cellWedge.phi0 + Math.PI * 0.8;
    const top = v3(Math.cos(az) * 0.4, 0.92, Math.sin(az) * 0.4).normalize();
    register('microvilli', mesh, top.multiplyScalar(membraneRadius(top) + 0.32));
  }

  // ---------------- nucleus: double envelope, pores, nucleolus
  const outerN = (d) => nucleusRadius(d);
  const innerN = (d) => nucleusRadius(d, 0.075);
  {
    const envOuter = new THREE.Mesh(deformedSphere(NUC_CENTER, outerN, 96, 72),
      material(PALETTE.nucleus, { side: THREE.DoubleSide, ...clipNuc }));
    const envInner = new THREE.Mesh(deformedSphere(NUC_CENTER, innerN, 96, 72),
      material(PALETTE.nucleusInner, { side: THREE.BackSide, roughness: 0.75, sheen: 0.8, ...clipNuc }));
    const cutMat = material(PALETTE.nucleusCut, { side: THREE.DoubleSide, roughness: 0.6 });
    const faces = new THREE.Group();
    const b1n = v3(-Math.sin(nucWedge.b1), 0, Math.cos(nucWedge.b1));
    const b2n = v3(Math.sin(nucWedge.b2), 0, -Math.cos(nucWedge.b2));
    faces.add(new THREE.Mesh(cutFace(NUC_CENTER, outerN, innerN, nucWedge.b1, b1n), cutMat));
    faces.add(new THREE.Mesh(cutFace(NUC_CENTER, outerN, innerN, nucWedge.b2, b2n), cutMat));

    // Nuclear pores, skipping the cut-away region.
    const poreGeo = new THREE.TorusGeometry(0.055, 0.02, 6, 12);
    const poreDirs = fibonacciSphere(300).filter((d) => {
      const phi = Math.atan2(d.z, d.x);
      let dphi = Math.atan2(Math.sin(phi - nucWedge.phi0), Math.cos(phi - nucWedge.phi0));
      return Math.abs(dphi) > nucWedge.alpha + 0.08;
    });
    const pores = new THREE.InstancedMesh(poreGeo, material(PALETTE.pore, { roughness: 0.4 }), poreDirs.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), Z = v3(0, 0, 1);
    poreDirs.forEach((d, i) => {
      q.setFromUnitVectors(Z, d);
      m.compose(NUC_CENTER.clone().addScaledVector(d, outerN(d) + 0.005), q, v3(1, 1, 1));
      pores.setMatrixAt(i, m);
    });

    const nucGroup = new THREE.Group();
    nucGroup.add(envOuter, envInner, faces, pores);
    const anchorDir = v3(-0.5, 0.75, -0.3).normalize();
    register('nucleus', nucGroup, NUC_CENTER.clone().addScaledVector(anchorDir, outerN(anchorDir)));

    // Nucleolus sits toward the opening so it is visible through the cut.
    const ncPos = NUC_CENTER.clone().add(v3(0.18, -0.05, 0.22));
    const nucleolus = new THREE.Mesh(
      deformedSphere(ncPos, (d) => 0.4 * (1 + 0.08 * Math.sin(5 * d.x) * Math.cos(4 * d.y)), 48, 36),
      material(PALETTE.nucleolus, { roughness: 0.7, sheen: 0.9 }),
    );
    register('nucleolus', nucleolus, ncPos);

    // Faint chromatin threads inside the nucleus.
    const threads = [];
    for (let k = 0; k < 14; k++) {
      const pts = [];
      let p = NUC_CENTER.clone().add(randomUnit(r).multiplyScalar(0.55 * r()));
      for (let j = 0; j < 6; j++) {
        pts.push(p.clone());
        p = p.clone().add(randomUnit(r).multiplyScalar(0.28));
        const off = p.clone().sub(NUC_CENTER);
        if (off.length() > 0.85) p = NUC_CENTER.clone().add(off.setLength(0.8));
      }
      threads.push(tube(pts, 0.022, 40, 5));
    }
    const chromatin = new THREE.Mesh(mergeGeometries(threads),
      material(0x7a66bd, { roughness: 0.8, sheen: 0.6, ...clipNuc }));
    nucGroup.add(chromatin);
    organelles.nucleus.materials.add(chromatin.material);
    chromatin.userData.organelle = 'nucleus';
  }

  // ---------------- rough ER: sheets wrapped around the nucleus, studded with ribosomes
  const rerExit = new THREE.Vector3();
  {
    const sheets = [], ribosomePts = [];
    const gapLo = nucWedge.phi0 - nucWedge.alpha - 0.06; // ER leaves the nucleus window open
    const gapHi = nucWedge.phi0 + nucWedge.alpha + 0.06;
    const bands = 8;
    for (let k = 0; k < bands; k++) {
      const R0 = 1.42 + k * 0.105;
      const startPhi = gapHi + r() * 0.25;
      const endPhi = gapLo + Math.PI * 2 - r() * 0.25 - (k === bands - 1 ? 0 : 0.1);
      const el0 = (r() - 0.5) * 0.9;
      const elAmp = 0.12 + r() * 0.18;
      const ph = r() * 6.28;
      const height = 0.2 + r() * 0.14;
      const isExit = k === bands - 1;
      const point = (t, out) => {
        const phi = startPhi + (endPhi - startPhi) * t;
        let el = el0 + elAmp * Math.sin(t * Math.PI * 3 + ph);
        if (isExit) el *= 1 - smoothstep(0.75, 1, t) * 0.9;
        const R = R0 * (1 + 0.04 * Math.sin(t * 17 + ph));
        const d = v3(Math.cos(el) * Math.cos(phi), Math.sin(el), Math.cos(el) * Math.sin(phi));
        return out.copy(NUC_CENTER).addScaledVector(d, R);
      };
      const thin = (t, c, out) => out.subVectors(c, NUC_CENTER).normalize();
      const env = (t) => smoothstep(0, 0.035, t) * smoothstep(1, 0.965, t);
      const a = (t) => 0.035 * Math.max(0.15, env(t)) * (1 + 0.5 * Math.pow(Math.sin(t * 40 + ph), 8));
      const b = (t) => height * Math.max(0.1, env(t)) * (1 + 0.12 * Math.sin(t * 23 + k));
      sheets.push(ribbon({ point, thinAxis: thin, a, b, segments: 260, radial: 14, squareness: 0.35 }));
      if (isExit) point(0.995, rerExit);

      // ribosomes on both faces of the sheet
      const c = new THREE.Vector3(), n = new THREE.Vector3(), T = new THREE.Vector3(), Bv = new THREE.Vector3();
      const p0 = new THREE.Vector3(), p1 = new THREE.Vector3();
      for (let s = 0; s < 240; s++) {
        const t = 0.02 + r() * 0.96;
        point(t, c); point(Math.max(0, t - 0.002), p0); point(Math.min(1, t + 0.002), p1);
        T.subVectors(p1, p0).normalize();
        n.subVectors(c, NUC_CENTER).normalize();
        n.addScaledVector(T, -n.dot(T)).normalize();
        Bv.crossVectors(T, n).normalize();
        const side = r() < 0.5 ? -1 : 1;
        ribosomePts.push(c.clone().addScaledVector(n, side * (a(t) + 0.022)).addScaledVector(Bv, (r() * 2 - 1) * b(t) * 0.85));
      }
    }
    const rerMat = material(PALETTE.rer, { side: THREE.DoubleSide, roughness: 0.45 });
    const rer = new THREE.Mesh(mergeGeometries(sheets), rerMat);
    const ribo = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.024, lowPower ? 0 : 1),
      material(PALETTE.ribosome, { roughness: 0.35 }), ribosomePts.length);
    const m = new THREE.Matrix4();
    ribosomePts.forEach((p, i) => { m.makeTranslation(p.x, p.y, p.z); ribo.setMatrixAt(i, m); });
    const rerGroup = new THREE.Group();
    rerGroup.add(rer, ribo);
    const aDir = v3(-0.7, 0.4, 0.55).normalize();
    register('rer', rerGroup, NUC_CENTER.clone().addScaledVector(aDir, 1.95));
  }

  // ---------------- Golgi apparatus: curved stack of cisternae plus budding vesicles
  const GOLGI = v3(1.72, 0.18, 1.32);
  // Stack axis runs sideways to the default view so the cisternae read as a stack;
  // the trans face points toward the membrane where secretion happens.
  const golgiAxis = v3(Math.cos(-0.5), 0, Math.sin(-0.5)); // cis -> trans
  const golgiSide = new THREE.Vector3().crossVectors(UP, golgiAxis).normalize();
  const golgiCis = GOLGI.clone().addScaledVector(golgiAxis, -0.5);
  const golgiTrans = GOLGI.clone().addScaledVector(golgiAxis, 0.48);
  {
    const plates = [];
    const n = 6, spacing = 0.15, Rc = 1.25;
    for (let k = 0; k < n; k++) {
      const center = GOLGI.clone().addScaledVector(golgiAxis, (k - (n - 1) / 2) * spacing);
      const curveCenter = center.clone().addScaledVector(golgiAxis, Rc);
      const span = 0.5 - k * 0.025;
      const height = 0.42 - Math.abs(k - 2.5) * 0.035;
      const point = (t, out) => {
        const psi = (t * 2 - 1) * span;
        return out.copy(curveCenter)
          .addScaledVector(golgiAxis, -Rc * Math.cos(psi))
          .addScaledVector(golgiSide, Rc * Math.sin(psi))
          .addScaledVector(UP, 0.03 * Math.sin(t * Math.PI * 2 + k));
      };
      const thin = (t, c, out) => out.copy(golgiAxis);
      const ell = (t) => Math.sqrt(Math.max(0, 1 - Math.pow(t * 2 - 1, 2)));
      const a = (t) => 0.03 + 0.05 * Math.pow(Math.abs(t * 2 - 1), 8); // dilated rims
      const b = (t) => Math.max(0.04, height * ell(t));
      const g = ribbon({ point, thinAxis: thin, a, b, segments: 90, radial: 16, squareness: 0.5 });
      const col = new THREE.Color(PALETTE.golgiCis).lerp(new THREE.Color(PALETTE.golgiTrans), k / (n - 1));
      plates.push({ g, col });
    }
    const golgiGroup = new THREE.Group();
    plates.forEach(({ g, col }) => golgiGroup.add(new THREE.Mesh(g, material(col, { roughness: 0.42 }))));
    register('golgi', golgiGroup, GOLGI.clone().add(v3(0, 0.55, 0)));

    // vesicles budding near both faces
    const vesMat = material(PALETTE.vesicle, { roughness: 0.3, clearcoat: 0.6 });
    const vg = [];
    for (let i = 0; i < 16; i++) {
      const face = i < 6 ? golgiCis : golgiTrans;
      const p = face.clone()
        .addScaledVector(golgiAxis, (i < 6 ? -1 : 1) * (0.05 + r() * 0.25))
        .addScaledVector(golgiSide, (r() * 2 - 1) * 0.75)
        .addScaledVector(UP, (r() * 2 - 1) * 0.45);
      const s = new THREE.SphereGeometry(0.05 + r() * 0.04, 16, 12);
      s.translate(p.x, p.y, p.z);
      vg.push(s);
    }
    for (let i = 0; i < 26; i++) {
      const d = randomUnit(r);
      const p = d.multiplyScalar(membraneRadius(d) * (0.45 + r() * 0.4));
      if (p.distanceTo(NUC_CENTER) < 2.4) continue;
      const s = new THREE.SphereGeometry(0.05 + r() * 0.05, 16, 12);
      s.translate(p.x, p.y, p.z);
      vg.push(s);
    }
    register('vesicle', new THREE.Mesh(mergeGeometries(vg), vesMat), golgiTrans.clone().addScaledVector(golgiSide, 0.7).add(v3(0, 0.3, 0)));
  }

  // ---------------- smooth ER: branching tubules near the base, continuous with the RER
  {
    const tubes = [];
    const origin = v3(0.15, -1.05, 1.05);
    for (let k = 0; k < 15; k++) {
      let p = origin.clone().add(v3((r() - 0.5) * 1.4, (r() - 0.5) * 0.5, (r() - 0.5) * 1.1));
      const pts = [p.clone()];
      let dir = randomUnit(r); dir.y = Math.abs(dir.y) * 0.4 - 0.15; dir.normalize();
      for (let j = 0; j < 5; j++) {
        dir.add(randomUnit(r).multiplyScalar(0.7)).normalize();
        p = p.clone().addScaledVector(dir, 0.26 + r() * 0.12);
        const rr = membraneRadius(p.clone().normalize());
        if (p.length() > rr * 0.86) p.setLength(rr * 0.86);
        if (p.distanceTo(NUC_CENTER) < 1.4) p.add(p.clone().sub(NUC_CENTER).setLength(0.3));
        pts.push(p.clone());
      }
      tubes.push(tube(pts, 0.052, 60, 10));
      // little caps at the free ends
      const cap = new THREE.SphereGeometry(0.052, 12, 10);
      cap.translate(pts[pts.length - 1].x, pts[pts.length - 1].y, pts[pts.length - 1].z);
      tubes.push(cap);
    }
    register('ser', new THREE.Mesh(mergeGeometries(tubes), material(PALETTE.ser, { roughness: 0.4 })), origin.clone().add(v3(0.2, -0.25, 0.4)));
  }

  // ---------------- mitochondria: opened lengthwise to show cristae
  {
    const spots = [
      [v3(2.35, -0.55, 0.45), v3(0.3, 0.2, 1)],
      [v3(0.95, -1.05, 2.05), v3(1, 0.15, -0.2)],
      [v3(-0.25, 1.1, 2.0), v3(1, -0.3, -0.4)],
      [v3(2.5, 0.5, -1.25), v3(0.2, 0.3, 1)],
      [v3(-1.95, -0.65, 1.75), v3(1, 0.4, 0.3)],
      [v3(-2.3, 0.35, -1.0), v3(0.3, 1, 0.2)],
      [v3(0.25, -1.45, -1.75), v3(1, 0, 0.5)],
      [v3(2.85, -0.2, -0.35), v3(0.1, 1, 0.4)],
    ];
    const camDir = v3(Math.cos(cellWedge.phi0), 0.9, Math.sin(cellWedge.phi0)).normalize();
    const mitoGroup = new THREE.Group();
    spots.forEach(([pos, ax], i) => {
      const axis = ax.clone().normalize();
      const len = 0.75 + r() * 0.45, rad = 0.24 + r() * 0.05;
      const q = new THREE.Quaternion().setFromUnitVectors(UP, axis);
      const view = camDir.clone().addScaledVector(axis, -camDir.dot(axis)).normalize();
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(view.clone().negate(), pos);
      const clip = { clippingPlanes: [plane] };
      const outerGeo = new THREE.CapsuleGeometry(rad, len, 10, 24);
      const innerGeo = new THREE.CapsuleGeometry(rad * 0.82, len * 0.98, 10, 24);
      const outer = new THREE.Mesh(outerGeo, material(PALETTE.mito, { side: THREE.DoubleSide, ...clip }));
      const inner = new THREE.Mesh(innerGeo, material(PALETTE.mitoInner, { side: THREE.BackSide, roughness: 0.7, sheen: 0.9, ...clip }));
      const one = new THREE.Group();
      one.add(outer, inner);
      // cristae: alternating shelves from opposite walls
      const crMat = material(PALETTE.mito, { side: THREE.DoubleSide, roughness: 0.5, ...clip });
      const count = Math.round(len / 0.12);
      for (let c = 0; c < count; c++) {
        const y = -len / 2 + (c + 0.5) * (len / count);
        // lens-shaped shelves with rounded rims, alternating from opposite walls
        const g = new THREE.SphereGeometry(rad * 0.74, 28, 12);
        g.scale(1, 0.075, 0.92);
        const side = c % 2 === 0 ? 1 : -1;
        g.translate(side * rad * 0.26, y, 0);
        one.add(new THREE.Mesh(g, crMat));
      }
      one.children.forEach((ch) => { ch.geometry.applyQuaternion(q); ch.geometry.translate(pos.x, pos.y, pos.z); });
      mitoGroup.add(one);
    });
    register('mitochondrion', mitoGroup, spots[0][0].clone().add(v3(0, 0.45, 0)));
  }

  // ---------------- lysosomes: enzyme-filled sacs (one is the delivery target)
  const lysosomes = [];
  const LYSO_TARGET = v3(2.55, -0.62, 1.05);
  {
    const spots = [LYSO_TARGET, v3(0.35, 0.65, 2.25), v3(-1.6, -1.15, 0.65), v3(1.15, 1.25, -1.55), v3(-0.95, 0.95, 1.85), v3(1.75, -1.35, -0.6)];
    const lysoGroup = new THREE.Group();
    const shellMat = material(PALETTE.lysosome, { transparent: true, opacity: 0.6, roughness: 0.25, clearcoat: 0.9, depthWrite: false });
    const contentMat = material(PALETTE.lysoContent, { roughness: 0.5 });
    const debrisMat = material(PALETTE.debris, { roughness: 0.9, sheen: 0.2 });
    spots.forEach((pos, i) => {
      const rad = i === 0 ? 0.3 : 0.2 + r() * 0.08;
      const holder = new THREE.Group();
      holder.position.copy(pos);
      const shell = new THREE.Mesh(new THREE.SphereGeometry(rad, 32, 24), shellMat);
      shell.renderOrder = 5;
      const dotGeo = new THREE.IcosahedronGeometry(rad * 0.13, 0);
      const dots = new THREE.InstancedMesh(dotGeo, contentMat, 14);
      const m = new THREE.Matrix4();
      for (let k = 0; k < 14; k++) {
        const d = randomUnit(r).multiplyScalar(rad * 0.65 * Math.cbrt(r()));
        m.makeTranslation(d.x, d.y, d.z); dots.setMatrixAt(k, m);
      }
      const debris = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(rad * 0.2, 1), debrisMat, 9);
      for (let k = 0; k < 9; k++) {
        const d = randomUnit(r).multiplyScalar(rad * 0.55 * Math.cbrt(r()));
        m.compose(d, new THREE.Quaternion(), v3(0.35, 0.35, 0.35)); debris.setMatrixAt(k, m);
      }
      debris.userData.base = Array.from({ length: 9 }, (_, k) => { const mm = new THREE.Matrix4(); debris.getMatrixAt(k, mm); const p = new THREE.Vector3().setFromMatrixPosition(mm); return p; });
      holder.add(dots, debris, shell);
      lysoGroup.add(holder);
      lysosomes.push({ holder, shell, debris, rad });
    });
    register('lysosome', lysoGroup, spots[1].clone().add(v3(0, 0.35, 0)));
  }

  // ---------------- peroxisomes: small sacs with a crystalline core
  {
    const spots = [v3(1.05, 0.25, 2.35), v3(2.05, 0.85, 0.35), v3(-0.35, -1.35, 1.95), v3(1.45, -1.45, -0.35), v3(-2.2, -0.2, 0.2)];
    const grp = new THREE.Group();
    const shellMat = material(PALETTE.peroxisome, { transparent: true, opacity: 0.6, roughness: 0.3, clearcoat: 0.8, depthWrite: false });
    const coreMat = material(PALETTE.peroxCore, { roughness: 0.4, flatShading: true });
    spots.forEach((p) => {
      const rad = 0.17 + r() * 0.04;
      const s = new THREE.Mesh(new THREE.SphereGeometry(rad, 28, 20), shellMat);
      s.position.copy(p); s.renderOrder = 5;
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(rad * 0.45, 0), coreMat);
      core.position.copy(p); core.rotation.set(r() * 3, r() * 3, r() * 3);
      grp.add(core, s);
    });
    register('peroxisome', grp, spots[0].clone().add(v3(0, 0.3, 0)));
  }

  // ---------------- centrosome: two orthogonal centrioles of nine microtubule triplets
  const CENTROSOME = v3(0.85, 0.95, 0.65);
  {
    const grp = new THREE.Group();
    const tri = new THREE.CylinderGeometry(0.019, 0.019, 0.36, 8);
    const mat = material(PALETTE.centriole, { roughness: 0.35, clearcoat: 0.6 });
    const makeCentriole = (axis, offset) => {
      const mesh = new THREE.InstancedMesh(tri, mat, 27);
      const qAxis = new THREE.Quaternion().setFromUnitVectors(UP, axis);
      const m = new THREE.Matrix4();
      let i = 0;
      for (let k = 0; k < 9; k++) {
        const ang = (k / 9) * Math.PI * 2;
        const radial = v3(Math.cos(ang), 0, Math.sin(ang));
        const tangent = v3(-Math.sin(ang), 0, Math.cos(ang));
        const blade = radial.clone().multiplyScalar(0.55).addScaledVector(tangent, 0.83).normalize();
        for (let j = 0; j < 3; j++) {
          const p = radial.clone().multiplyScalar(0.115).addScaledVector(blade, (j - 1) * 0.034);
          p.applyQuaternion(qAxis).add(offset);
          m.compose(p, qAxis, v3(1, 1, 1));
          mesh.setMatrixAt(i++, m);
        }
      }
      grp.add(mesh);
    };
    makeCentriole(v3(1, 0.2, 0.3).normalize(), CENTROSOME.clone());
    makeCentriole(v3(-0.25, 1, 0.15).normalize(), CENTROSOME.clone().add(v3(-0.08, 0.05, 0.28)));
    register('centrosome', grp, CENTROSOME.clone().add(v3(0, 0.35, 0)));
  }

  // ---------------- cytoskeleton
  {
    // Microtubules radiate from the centrosome to the cell periphery.
    const mts = [], proxies = [];
    const dirs = fibonacciSphere(16);
    dirs.forEach((d, i) => {
      const end = d.clone().multiplyScalar(membraneRadius(d) * 0.94);
      const start = CENTROSOME.clone().addScaledVector(d, 0.2);
      const mid = start.clone().lerp(end, 0.5).add(randomUnit(r).multiplyScalar(0.35));
      if (mid.distanceTo(NUC_CENTER) < 1.35) mid.add(mid.clone().sub(NUC_CENTER).setLength(0.6));
      const pts = [start, mid, end];
      mts.push(tube(pts, 0.012, 64, 6));
      proxies.push(tube(pts, 0.075, 32, 5));
    });
    const mt = new THREE.Mesh(mergeGeometries(mts), material(PALETTE.microtubule, { roughness: 0.35, ...clipCell }));
    const proxy = new THREE.Mesh(mergeGeometries(proxies), new THREE.MeshBasicMaterial({ visible: false, ...clipCell }));
    proxy.userData.pickProxy = true;
    const g = new THREE.Group(); g.add(mt, proxy);
    const ad = dirs[10];
    register('microtubule', g, CENTROSOME.clone().lerp(ad.clone().multiplyScalar(membraneRadius(ad) * 0.9), 0.55));

    // Actin cortex just beneath the membrane.
    const act = [], actProxy = [];
    fibonacciSphere(36).forEach((d) => {
      const rr = membraneRadius(d) * 0.955;
      const t1 = new THREE.Vector3().crossVectors(d, Math.abs(d.y) > 0.9 ? v3(1, 0, 0) : UP).normalize();
      const pts = [];
      for (let j = -2; j <= 2; j++) {
        const dd = d.clone().addScaledVector(t1, j * 0.09).addScaledVector(randomUnit(r), 0.025).normalize();
        pts.push(dd.multiplyScalar(rr));
      }
      act.push(tube(pts, 0.008, 20, 4));
      actProxy.push(tube(pts, 0.06, 10, 4));
    });
    const actin = new THREE.Mesh(mergeGeometries(act), material(PALETTE.actin, { roughness: 0.6, ...clipCell }));
    const actinProxy = new THREE.Mesh(mergeGeometries(actProxy), new THREE.MeshBasicMaterial({ visible: false, ...clipCell }));
    const ag = new THREE.Group(); ag.add(actin, actinProxy);
    const actAnchor = v3(Math.cos(cellWedge.phi0 + 1.45), -0.25, Math.sin(cellWedge.phi0 + 1.45)).normalize();
    register('actin', ag, actAnchor.multiplyScalar(membraneRadius(actAnchor) * 0.95));

    // Intermediate filaments: long ropes from the nucleus to the periphery.
    const ifs = [], ifProxy = [];
    let ifAnchor = null;
    for (let k = 0; k < 7; k++) {
      const d = randomUnit(r);
      const start = NUC_CENTER.clone().addScaledVector(d, outerN(d) + 0.05);
      const outDir = start.clone().normalize().lerp(d, 0.5).normalize();
      const end = outDir.clone().multiplyScalar(membraneRadius(outDir) * 0.95);
      const m1 = start.clone().lerp(end, 0.33).add(randomUnit(r).multiplyScalar(0.3));
      const m2 = start.clone().lerp(end, 0.66).add(randomUnit(r).multiplyScalar(0.3));
      ifs.push(tube([start, m1, m2, end], 0.017, 80, 6));
      if (!ifAnchor && m2.x > 0 && m2.z > 0) ifAnchor = m2.clone();
      ifProxy.push(tube([start, m1, m2, end], 0.07, 40, 5));
    }
    const ifMesh = new THREE.Mesh(mergeGeometries(ifs), material(PALETTE.intermediate, { roughness: 0.65, ...clipCell }));
    const ifP = new THREE.Mesh(mergeGeometries(ifProxy), new THREE.MeshBasicMaterial({ visible: false, ...clipCell }));
    const ig = new THREE.Group(); ig.add(ifMesh, ifP);
    register('intermediate', ig, ifAnchor || v3(-0.4, -1.2, 1.6));
  }

  // ---------------- free ribosomes scattered in the cytosol
  {
    const pts = [];
    while (pts.length < 90) {
      const d = randomUnit(r);
      const p = d.multiplyScalar(membraneRadius(d) * Math.cbrt(r()) * 0.9);
      if (p.distanceTo(NUC_CENTER) < 2.35) continue;
      if (p.distanceTo(GOLGI) < 0.75) continue;
      pts.push(p);
    }
    const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.026, 0), material(PALETTE.ribosome, { roughness: 0.35 }), pts.length);
    const m = new THREE.Matrix4();
    pts.forEach((p, i) => { m.makeTranslation(p.x, p.y, p.z); mesh.setMatrixAt(i, m); });
    register('ribosome', mesh, pts.find((p) => p.x > 1 && p.z > 1 && p.y > -0.2) || pts[0]);
  }

  // ---------------- cut faces of the membrane, rebuilt when the cutaway angle changes
  const outerM = (d) => membraneRadius(d);
  const innerM = (d) => membraneRadius(d) - 0.12;
  function rebuildMembraneCut() {
    memCut.children.forEach((c) => c.geometry.dispose());
    memCut.clear();
    if (cellWedge.alpha < 0.01) return;
    const n1 = v3(-Math.sin(cellWedge.b1), 0, Math.cos(cellWedge.b1));
    const n2 = v3(Math.sin(cellWedge.b2), 0, -Math.cos(cellWedge.b2));
    const f1 = new THREE.Mesh(cutFace(v3(0, 0, 0), outerM, innerM, cellWedge.b1, n1), memCutMat);
    const f2 = new THREE.Mesh(cutFace(v3(0, 0, 0), outerM, innerM, cellWedge.b2, n2), memCutMat);
    f1.userData.organelle = f2.userData.organelle = 'membrane';
    memCut.add(f1, f2);
  }
  rebuildMembraneCut();
  {
    const back = v3(Math.cos(cellWedge.phi0 + Math.PI * 0.95), 0.35, Math.sin(cellWedge.phi0 + Math.PI * 0.95)).normalize();
    organelles.membrane.anchor = back.multiplyScalar(membraneRadius(back) - 0.08);
  }

  // ---------------- soft contact shadow
  {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const grd = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
    grd.addColorStop(0, 'rgba(40,55,75,0.32)');
    grd.addColorStop(0.55, 'rgba(40,55,75,0.12)');
    grd.addColorStop(1, 'rgba(40,55,75,0)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(9, 8), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -2.25;
    shadow.userData.nopick = true;
    group.add(shadow);
  }

  // Exocytosis exit: a point on the intact membrane just outside the cutaway.
  const exitDir = v3(Math.cos(cellWedge.phi0 - cellWedge.alpha - 0.3), -0.1, Math.sin(cellWedge.phi0 - cellWedge.alpha - 0.3)).normalize();
  const exitPoint = exitDir.clone().multiplyScalar(membraneRadius(exitDir) - 0.12);

  return {
    group,
    organelles,
    lysosomes,
    cellWedge,
    setCutaway(alpha) { cellWedge.set(alpha); rebuildMembraneCut(); },
    points: {
      rerExit, golgiCis, golgiTrans, golgi: GOLGI, golgiAxis, golgiSide,
      lysosome: LYSO_TARGET, exitDir, exitPoint, nucleus: NUC_CENTER, centrosome: CENTROSOME,
    },
  };
}
