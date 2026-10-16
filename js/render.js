// Rendering pipeline: MSAA scene render -> ambient occlusion -> tone-mapped output.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// The stock GTAO pass renders depth/normals with one override material, which throws
// away each object's clipping planes. The cutaway depends on clipping, so the invisible
// cut-away membrane would still shade everything. This version swaps in a per-material
// normal material that keeps the clipping, and leaves translucent surfaces out of the AO.
class ClippedGTAOPass extends GTAOPass {
  constructor(...args) {
    super(...args);
    this._normalMats = new Map();
    this._swapped = [];
  }

  normalMaterialFor(src) {
    let m = this._normalMats.get(src);
    if (!m) {
      m = new THREE.MeshNormalMaterial({
        side: src.side,
        blending: THREE.NoBlending,
        clippingPlanes: src.clippingPlanes,
        clipIntersection: src.clipIntersection,
      });
      this._normalMats.set(src, m);
    }
    return m;
  }

  overrideVisibility() {
    super.overrideVisibility();
    this.scene.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      const mat = o.material;
      if (!mat || mat.transparent || mat.visible === false || o.userData.noAO) { o.visible = false; return; }
      this._swapped.push([o, mat]);
      o.material = this.normalMaterialFor(mat);
    });
  }

  restoreVisibility() {
    for (const [o, mat] of this._swapped) o.material = mat;
    this._swapped.length = 0;
    super.restoreVisibility();
  }

  renderOverride(renderer, overrideMaterial, renderTarget, clearColor, clearAlpha) {
    // Same as the parent, minus scene.overrideMaterial (materials were swapped per mesh).
    renderer.getClearColor(this.originalClearColor);
    const originalClearAlpha = renderer.getClearAlpha();
    const originalAutoClear = renderer.autoClear;
    renderer.setRenderTarget(renderTarget);
    renderer.autoClear = false;
    renderer.setClearColor(clearColor);
    renderer.setClearAlpha(clearAlpha || 0.0);
    renderer.clear();
    const bg = this.scene.background;
    this.scene.background = null;
    renderer.render(this.scene, this.camera);
    this.scene.background = bg;
    renderer.autoClear = originalAutoClear;
    renderer.setClearColor(this.originalClearColor);
    renderer.setClearAlpha(originalClearAlpha);
  }
}

export function createPipeline(renderer, scene, camera, { lowPower = false } = {}) {
  const size = renderer.getSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.HalfFloatType,
    samples: lowPower ? 2 : 4,
  });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));

  const ao = new ClippedGTAOPass(scene, camera, size.x, size.y);
  ao.output = GTAOPass.OUTPUT.Default;
  ao.blendIntensity = 1.0;
  ao.updateGtaoMaterial({
    radius: 0.32,
    distanceExponent: 1.4,
    thickness: 1.2,
    scale: 1.15,
    samples: lowPower ? 8 : 16,
    distanceFallOff: 1,
    screenSpaceRadius: false,
  });
  ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: lowPower ? 8 : 16 });
  composer.addPass(ao);
  composer.addPass(new OutputPass());

  return {
    composer,
    ao,
    setSize(w, h, pixelRatio) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(w, h);
    },
    render(dt) { composer.render(dt); },
  };
}
