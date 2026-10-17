// Animated explanation: the route a lysosomal enzyme takes, normally and in I-cell disease.
import * as THREE from 'three';

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const seg = (t, a, b) => clamp01((t - a) / (b - a));

const COLORS = {
  enzyme: 0xf0b429,
  tag: 0xc2257a,
  vesicle: 0xcfc3ea,
  fail: 0xd9365e,
};

export class Pathway {
  constructor({ scene, cell, labels, onStep }) {
    this.cell = cell;
    this.labels = labels;
    this.onStep = onStep || (() => {});
    this.mode = 'normal';
    this.index = 0;
    this.t = 0;
    this.playing = false;
    this.hold = 0;

    const P = cell.points;
    const up = v3(0, 1, 0);
    this.P = P;

    // Paths
    const cisIn = P.golgiCis.clone().addScaledVector(P.golgiAxis, -0.14);
    const transOut = P.golgiTrans.clone().addScaledVector(P.golgiAxis, 0.16);
    this.curveToCis = new THREE.CatmullRomCurve3([
      P.rerExit.clone(),
      P.rerExit.clone().lerp(cisIn, 0.5).addScaledVector(up, 0.25),
      cisIn,
    ]);
    this.curveThroughGolgi = new THREE.CatmullRomCurve3([
      cisIn,
      P.golgi.clone().addScaledVector(up, 0.68).addScaledVector(P.golgiAxis, -0.2),
      P.golgi.clone().addScaledVector(up, 0.68).addScaledVector(P.golgiAxis, 0.2),
      transOut,
    ]);
    const lysoEdge = P.lysosome.clone().add(transOut.clone().sub(P.lysosome).setLength(0.05));
    this.curveToLyso = new THREE.CatmullRomCurve3([
      transOut,
      transOut.clone().lerp(lysoEdge, 0.5).addScaledVector(up, 0.15),
      lysoEdge,
    ]);
    this.curveToMembrane = new THREE.CatmullRomCurve3([
      transOut,
      transOut.clone().lerp(P.exitPoint, 0.45).addScaledVector(up, 0.2),
      P.exitPoint.clone(),
    ]);
    this.outside = P.exitPoint.clone().addScaledVector(P.exitDir, 1.3);

    // Cargo: a vesicle carrying three enzymes, each with a slot for its M6P tag.
    this.cargo = new THREE.Group();
    this.cargo.visible = false;
    const enzMat = new THREE.MeshPhysicalMaterial({ color: COLORS.enzyme, roughness: 0.3, clearcoat: 0.8, emissive: COLORS.enzyme, emissiveIntensity: 0.25 });
    const tagMat = new THREE.MeshPhysicalMaterial({ color: COLORS.tag, roughness: 0.3, clearcoat: 0.8, emissive: COLORS.tag, emissiveIntensity: 0.3 });
    this.enzymes = [];
    const offsets = [v3(0.045, 0.02, 0), v3(-0.03, 0.03, 0.04), v3(-0.015, -0.04, -0.035)];
    offsets.forEach((o) => {
      const e = new THREE.Group();
      e.userData.base = o.clone();
      e.userData.spread = o.clone().normalize().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, Math.random() * 0.4, (Math.random() - 0.5) * 0.4)).normalize();
      const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 2), enzMat);
      const tag = new THREE.Mesh(new THREE.OctahedronGeometry(0.026, 0), tagMat);
      tag.position.copy(o.clone().normalize().multiplyScalar(0.055));
      e.add(body, tag);
      e.userData.tag = tag;
      this.cargo.add(e);
      this.enzymes.push(e);
    });
    this.vesicle = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 32, 24),
      new THREE.MeshPhysicalMaterial({ color: COLORS.vesicle, transparent: true, opacity: 0.45, roughness: 0.15, clearcoat: 1, depthWrite: false }),
    );
    this.vesicle.renderOrder = 6;
    this.cargo.add(this.vesicle);
    this.failRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.014, 10, 48),
      new THREE.MeshBasicMaterial({ color: COLORS.fail, transparent: true, opacity: 0.9 }),
    );
    this.cargo.add(this.failRing);
    scene.add(this.cargo);

    // The target lysosome gets its own material so it can glow on delivery.
    const target = cell.lysosomes[0];
    target.shell.material = target.shell.material.clone();
    cell.organelles.lysosome.materials.add(target.shell.material);
    this.target = target;

    this.buildSteps();
  }

  setMode(mode) {
    this.mode = mode;
    this.buildSteps();
    this.go(0, { play: true });
  }

  buildSteps() {
    const P = this.P;
    const wedgeDir = v3(Math.cos(this.cell.cellWedge.phi0), 0, Math.sin(this.cell.cellWedge.phi0));
    const view = (dist, lift = 0.75, extra) => {
      const d = wedgeDir.clone().add(v3(0, lift, 0));
      if (extra) d.add(extra);
      return d.normalize().multiplyScalar(dist);
    };
    const common = [
      {
        title: 'Made on the rough ER',
        body: 'Ribosomes on the rough ER translate the hydrolase and thread it into the ER, where N-linked glycosylation begins.',
        focus: () => ({ target: P.rerExit, offset: view(7.6) }),
        dur: 2.6,
        anim: (t, S) => { S.pos.copy(P.rerExit); S.enz = ease(seg(t, 0.1, 0.8)); S.visible = true; S.label = ['rer', 'Rough ER', P.rerExit, 'path']; },
      },
      {
        title: 'Carried to the cis-Golgi',
        body: 'A COPII-coated vesicle buds off the ER and carries the enzymes to the cis face of the Golgi.',
        focus: () => ({ target: P.golgiCis.clone().lerp(P.rerExit, 0.4), offset: view(7.6) }),
        dur: 3,
        anim: (t, S) => { S.ves = ease(seg(t, 0, 0.25)); S.pos.copy(this.curveToCis.getPoint(ease(seg(t, 0.2, 1)))); S.label = ['cis', 'cis-Golgi', P.golgiCis.clone().addScaledVector(v3(0, 1, 0), 0.62), 'path']; },
      },
    ];
    const tagStep = this.mode === 'normal'
      ? {
        title: 'Tagged with mannose-6-phosphate',
        body: 'GlcNAc-1-phosphotransferase adds a phosphate to mannose residues on each enzyme. A second enzyme trims off the leftover sugar, exposing the mannose-6-phosphate (M6P) tag.',
        focus: () => ({ target: P.golgiCis, offset: view(7) }),
        dur: 3,
        anim: (t, S) => { S.tag = ease(seg(t, 0.2, 0.75)); S.pulse = t; S.label = ['tag', 'M6P tag added', S.pos.clone().addScaledVector(v3(0, 1, 0), 0.3), 'tag']; },
      }
      : {
        title: 'The tag is never added',
        body: 'In I-cell disease, GlcNAc-1-phosphotransferase is deficient, so the enzymes leave the cis-Golgi with no M6P tag.',
        focus: () => ({ target: P.golgiCis, offset: view(7) }),
        dur: 3,
        anim: (t, S) => { S.fail = Math.sin(seg(t, 0.1, 0.9) * Math.PI); S.label = ['tag', 'No M6P tag', S.pos.clone().addScaledVector(v3(0, 1, 0), 0.3), 'fail']; },
      };
    const sortStep = {
      title: 'Sorted in the trans-Golgi',
      body: this.mode === 'normal'
        ? 'M6P receptors in the trans-Golgi bind the tag and package the enzymes into clathrin-coated vesicles bound for lysosomes.'
        : 'With no M6P to bind, the receptors in the trans-Golgi let the enzymes pass. They drop into the default secretory pathway.',
      focus: () => ({ target: P.golgi, offset: view(7.2) }),
      dur: 3.2,
      anim: (t, S) => { S.pos.copy(this.curveThroughGolgi.getPoint(ease(t))); S.label = ['trans', 'trans-Golgi', P.golgiTrans.clone().addScaledVector(v3(0, 1, 0), 0.62), 'path']; },
    };
    const normalEnd = [
      {
        title: 'Delivered to the lysosome',
        body: 'The vesicle fuses with a lysosome. In its acidic interior the enzymes are released from their receptors and start digesting stored material.',
        focus: () => ({ target: P.lysosome.clone().lerp(P.golgiTrans, 0.35), offset: view(7.6) }),
        dur: 3.6,
        anim: (t, S) => {
          S.pos.copy(this.curveToLyso.getPoint(ease(seg(t, 0, 0.6))));
          S.ves = 1 - ease(seg(t, 0.55, 0.75));
          S.enz = 1 - ease(seg(t, 0.62, 0.8));
          S.glow = Math.sin(seg(t, 0.55, 1) * Math.PI);
          S.digest = ease(seg(t, 0.65, 1));
          S.label = ['lyso', 'Lysosome', P.lysosome.clone().addScaledVector(v3(0, 1, 0), 0.5), 'path'];
        },
      },
    ];
    const diseaseEnd = [
      {
        title: 'Secreted out of the cell',
        body: 'The vesicle fuses with the plasma membrane and releases the enzymes outside the cell. That is why plasma hydrolase activity is so high.',
        focus: () => ({ target: P.exitPoint.clone().lerp(P.golgiTrans, 0.45), offset: view(9, 0.6) }),
        dur: 4,
        anim: (t, S) => {
          const a = seg(t, 0, 0.55);
          S.pos.copy(this.curveToMembrane.getPoint(ease(a)));
          S.ves = 1 - ease(seg(t, 0.5, 0.62));
          const b = ease(seg(t, 0.55, 1));
          S.pos.lerp(this.outside, b);
          S.spread = b;
          S.label = ['out', 'Into the blood', this.outside.clone().addScaledVector(v3(0, 1, 0), 0.4), 'fail'];
        },
      },
      {
        title: 'Lysosomes fill with debris',
        body: 'Lacking their hydrolases, lysosomes cannot break down glycosaminoglycans and lipids. They swell into the inclusions seen in the fibroblasts, the “I” in I-cell.',
        focus: () => ({ target: v3(0.6, -0.1, 0.4), offset: view(11.5) }),
        dur: 3.6,
        anim: (t, S) => {
          S.swell = ease(seg(t, 0.05, 0.85));
          S.label = ['incl', 'Swollen lysosome', P.lysosome.clone().addScaledVector(v3(0, 1, 0), 0.6), 'fail'];
        },
      },
    ];
    this.steps = [...common, tagStep, sortStep, ...(this.mode === 'normal' ? normalEnd : diseaseEnd)];
  }

  freshState() {
    return { visible: false, pos: this.P.rerExit.clone(), enz: 0, ves: 0, tag: 0, fail: 0, pulse: 0, glow: 0, digest: 0, spread: 0, swell: 0, label: null };
  }

  stateAt(index, t) {
    const S = this.freshState();
    for (let i = 0; i < index; i++) { this.steps[i].anim(1, S); S.label = null; }
    this.steps[index].anim(t, S);
    return S;
  }

  apply(S) {
    this.cargo.visible = S.visible;
    this.cargo.position.copy(S.pos);
    this.vesicle.scale.setScalar(Math.max(0.001, S.ves));
    this.vesicle.visible = S.ves > 0.01;
    const bump = 1 + 0.35 * Math.sin(S.pulse * Math.PI);
    this.enzymes.forEach((e) => {
      e.scale.setScalar(Math.max(0.001, S.enz) * (S.spread > 0 ? 1.2 : 1));
      e.position.copy(e.userData.base).addScaledVector(e.userData.spread, S.spread * 0.75);
      e.userData.tag.scale.setScalar(Math.max(0.001, S.tag * bump));
      e.userData.tag.visible = S.tag > 0.01;
    });
    this.failRing.visible = S.fail > 0.01;
    this.failRing.scale.setScalar(0.6 + S.fail * 0.6);
    this.failRing.material.opacity = S.fail;
    this.failRing.lookAt(this.cargo.position.clone().add(v3(1, 0.8, 1)));

    const m = this.target.shell.material;
    m.emissive.setHex(0x7fe0c8);
    m.emissiveIntensity = S.glow * 0.8;

    // Lysosome contents: digestion empties the target; disease swells all of them.
    const tmp = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    this.cell.lysosomes.forEach((L, i) => {
      const swellScale = 1 + 0.55 * S.swell;
      L.holder.scale.setScalar(swellScale);
      let debrisScale = 0.35 * (1 + 1.4 * S.swell);
      if (i === 0) debrisScale *= 1 - 0.85 * S.digest;
      L.debris.userData.base.forEach((p, k) => {
        s.setScalar(Math.max(0.001, debrisScale));
        tmp.compose(p, q, s);
        L.debris.setMatrixAt(k, tmp);
      });
      L.debris.instanceMatrix.needsUpdate = true;
    });

    this.labels.setPathLabel(S.label);
    this.onApply?.();
  }

  go(index, { play = true } = {}) {
    this.index = Math.max(0, Math.min(this.steps.length - 1, index));
    this.t = 0;
    this.playing = play;
    this.hold = 0;
    this.apply(this.stateAt(this.index, 0));
    this.onStep(this.index, this.steps[this.index]);
  }

  togglePlay() {
    if (this.index === this.steps.length - 1 && this.t >= 1) { this.go(0); return; }
    this.playing = !this.playing;
  }

  update(dt) {
    if (!this.active || !this.playing) return;
    const step = this.steps[this.index];
    if (this.t < 1) {
      this.t = Math.min(1, this.t + dt / step.dur);
      this.apply(this.stateAt(this.index, this.t));
      return;
    }
    this.hold += dt;
    if (this.hold > 1.4) {
      if (this.index < this.steps.length - 1) this.go(this.index + 1);
      else { this.playing = false; this.onStep(this.index, step); }
    }
  }

  start(mode = 'normal') { this.active = true; this.mode = mode; this.buildSteps(); this.go(0); }

  stop() {
    this.active = false;
    this.playing = false;
    this.apply(this.freshState());
    this.labels.setPathLabel(null);
  }
}
