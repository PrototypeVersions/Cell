import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildCell, PALETTE } from './cell.js';
import { createPipeline } from './render.js';
import { Pathway } from './pathway.js';
import { ORGANELLES, QUESTION, SPOT_IT } from './content.js';

const $ = (id) => document.getElementById(id);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const DEG = Math.PI / 180;

// ---------------------------------------------------------------- renderer + scene
const canvas = $('gl');
const stage = $('stage');
const lowPower = window.matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 700;
const pixelRatio = Math.min(window.devicePixelRatio, lowPower ? 1.5 : 2);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(pixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.localClippingEnabled = true;
const scene = new THREE.Scene();
// Background: the same pale slide-glass gradient as the page, drawn in the scene so the
// post-processing chain stays opaque.
{
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(282, 230, 20, 256, 256, 400);
  grd.addColorStop(0, '#fbfcfd');
  grd.addColorStop(0.55, '#eef2f5');
  grd.addColorStop(1, '#d6dfe7');
  g.fillStyle = grd; g.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  scene.background = tex;
}
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;
scene.add(new THREE.HemisphereLight(0xffffff, 0xaab8c6, 0.75));
// Soft key light from upper left, casting shadows across the open interior.
const key = new THREE.DirectionalLight(0xfffaf2, 2.1);
key.position.set(-3.5, 9, 5.5);
key.castShadow = true;
key.shadow.mapSize.set(lowPower ? 1024 : 2048, lowPower ? 1024 : 2048);
Object.assign(key.shadow.camera, { left: -4.5, right: 4.5, top: 4.5, bottom: -4.5, near: 1, far: 22 });
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.035;
key.shadow.radius = 5;
scene.add(key);
const fill = new THREE.DirectionalLight(0xdfe8ff, 0.55);
fill.position.set(7, 2, -3);
scene.add(fill);

const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 2.2;
controls.maxDistance = 22;
controls.autoRotateSpeed = 0.55;
controls.autoRotate = !reduceMotion;

const cell = buildCell({ lowPower });
scene.add(cell.group);
cell.group.traverse((o) => {
  if (!o.isMesh || !o.material) return;
  const m = o.material;
  if (m.visible === false || o.userData.nopick && m.transparent) return;
  o.receiveShadow = true;
  // The membrane would shade the whole interior; let light fall through it.
  o.castShadow = !m.transparent && !o.userData.noAO && o.userData.organelle !== 'membrane';
});
const pipeline = createPipeline(renderer, scene, camera, { lowPower });

const HOME = (() => {
  const phi = cell.cellWedge.phi0 + 8 * DEG;
  const target = new THREE.Vector3(0.2, -0.05, 0.2);
  const offset = new THREE.Vector3(Math.cos(phi), 0.62, Math.sin(phi)).normalize().multiplyScalar(13.4);
  return { target, offset };
})();
camera.position.copy(HOME.target).add(HOME.offset);
controls.target.copy(HOME.target);

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  pipeline.setSize(w, h, pixelRatio);
  camera.aspect = w / h;
  // Pull back a little on narrow viewports so the whole cell fits.
  camera.fov = w / h < 0.9 ? 42 : 32;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();

// ---------------------------------------------------------------- camera moves
let flight = null;
function flyTo({ target, offset }, duration = 1.5) {
  const toTarget = target.clone();
  const toPos = target.clone().add(offset);
  if (reduceMotion || duration === 0) {
    controls.target.copy(toTarget); camera.position.copy(toPos); flight = null; return;
  }
  flight = { t: 0, duration, fromTarget: controls.target.clone(), fromPos: camera.position.clone(), toTarget, toPos };
}
function stepFlight(dt) {
  if (!flight) return;
  flight.t = Math.min(1, flight.t + dt / flight.duration);
  const e = flight.t < 0.5 ? 4 * flight.t ** 3 : 1 - Math.pow(-2 * flight.t + 2, 3) / 2;
  controls.target.lerpVectors(flight.fromTarget, flight.toTarget, e);
  // Arc through a slightly wider radius so the move reads as orbiting, not zooming through.
  const pos = new THREE.Vector3().lerpVectors(flight.fromPos, flight.toPos, e);
  const mid = Math.sin(e * Math.PI) * 0.12;
  pos.add(pos.clone().sub(controls.target).multiplyScalar(mid));
  camera.position.copy(pos);
  if (flight.t >= 1) flight = null;
}

// ---------------------------------------------------------------- labels
const labelLayer = $('labels');
const allLabels = [];
let labelsOn = false;
const tmpV = new THREE.Vector3();

function makeLabel(text, cls = '') {
  const el = document.createElement('div');
  el.className = `lbl ${cls}`;
  el.textContent = text;
  labelLayer.appendChild(el);
  return el;
}
for (const [k, o] of Object.entries(cell.organelles)) {
  if (!o.anchor || !ORGANELLES[k]) continue;
  const el = makeLabel(ORGANELLES[k].name);
  el.classList.add('hidden');
  allLabels.push({ key: k, el, pos: o.anchor });
}
const pathLabel = { el: makeLabel('', 'path hidden'), pos: new THREE.Vector3(), on: false };

const labels = {
  setPathLabel(spec) {
    if (!spec) { pathLabel.on = false; pathLabel.el.classList.add('hidden'); return; }
    const [, text, pos, variant] = spec;
    pathLabel.on = true;
    pathLabel.pos.copy(pos);
    pathLabel.el.textContent = text;
    pathLabel.el.className = `lbl ${variant}`;
  },
};

function placeLabel(el, pos) {
  tmpV.copy(pos).project(camera);
  if (tmpV.z > 1) { el.style.visibility = 'hidden'; return; }
  el.style.visibility = 'visible';
  const x = (tmpV.x * 0.5 + 0.5) * stage.clientWidth;
  const y = (-tmpV.y * 0.5 + 0.5) * stage.clientHeight - 10;
  el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
}
function updateLabels() {
  for (const l of allLabels) {
    const show = labelsOn && !pathway.active;
    l.el.classList.toggle('hidden', !show);
    if (show) placeLabel(l.el, l.pos);
  }
  if (pathLabel.on) placeLabel(pathLabel.el, pathLabel.pos);
}

// ---------------------------------------------------------------- highlight + picking
const highlightColors = { select: new THREE.Color(0x5a3fd0), ok: new THREE.Color(0x1f9a6c), no: new THREE.Color(0xd23b63) };
let highlighted = null;
function highlight(key, kind = 'select') {
  if (highlighted) {
    for (const m of cell.organelles[highlighted].materials) {
      if (m.emissive && m.userData.baseEmissive) { m.emissive.copy(m.userData.baseEmissive); m.emissiveIntensity = m.userData.baseIntensity; }
    }
  }
  highlighted = key;
  if (!key) return;
  for (const m of cell.organelles[key].materials) {
    if (!m.emissive) continue;
    if (!m.userData.baseEmissive) { m.userData.baseEmissive = m.emissive.clone(); m.userData.baseIntensity = m.emissiveIntensity; }
    m.emissive.copy(highlightColors[kind]);
    m.emissiveIntensity = 0.45;
  }
}

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const pickables = [];
cell.group.traverse((o) => { if (o.isMesh && o.userData.organelle && !o.userData.nopick) pickables.push(o); });

function isClipped(mat, p) {
  const planes = mat.clippingPlanes;
  if (!planes || !planes.length) return false;
  return mat.clipIntersection ? planes.every((pl) => pl.distanceToPoint(p) < 0) : planes.some((pl) => pl.distanceToPoint(p) < 0);
}
function pick(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  // refresh: the membrane's cut faces are rebuilt when the cutaway changes
  const targets = pickables.concat(cell.organelles.membrane.objects[0].children[2].children);
  const hits = raycaster.intersectObjects(targets, false);
  for (const h of hits) {
    if (isClipped(h.object.material, h.point)) continue;
    return h.object.userData.organelle || h.object.parent?.userData.organelle;
  }
  return null;
}

// ---------------------------------------------------------------- tooltip + clicks
const tooltip = $('tooltip');
let hoverKey = null, pendingMove = null;
canvas.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') pendingMove = e; });
canvas.addEventListener('pointerleave', () => { pendingMove = null; tooltip.classList.remove('on'); canvas.classList.remove('pointing'); hoverKey = null; });
function processHover() {
  if (!pendingMove) return;
  const e = pendingMove; pendingMove = null;
  if (e.buttons) { tooltip.classList.remove('on'); return; }
  const k = pick(e.clientX, e.clientY);
  hoverKey = k;
  const rect = stage.getBoundingClientRect();
  if (k && ORGANELLES[k]) {
    tooltip.textContent = mode === 'spot' ? 'Select this structure' : ORGANELLES[k].name;
    tooltip.style.left = `${e.clientX - rect.left}px`;
    tooltip.style.top = `${e.clientY - rect.top}px`;
    tooltip.classList.add('on');
    canvas.classList.add('pointing');
  } else {
    tooltip.classList.remove('on');
    canvas.classList.remove('pointing');
  }
}

let down = null;
canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
canvas.addEventListener('pointerup', (e) => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  const quick = performance.now() - down.t < 500;
  down = null;
  if (moved > 6 || !quick) return;
  const k = pick(e.clientX, e.clientY);
  onCellClick(k);
});

let interacted = false;
controls.addEventListener('start', () => {
  controls.autoRotate = false;
  $('spinBtn').setAttribute('aria-pressed', 'false');
  flight = null;
  if (!interacted) { interacted = true; $('hint').classList.add('gone'); }
});

// ---------------------------------------------------------------- view bar
const cutInput = $('cut');
let cutAnim = null;
cutInput.addEventListener('input', () => { cutAnim = null; cell.setCutaway(Number(cutInput.value) * DEG); });
$('labelsBtn').addEventListener('click', (e) => {
  labelsOn = !labelsOn;
  e.currentTarget.setAttribute('aria-pressed', String(labelsOn));
});
$('spinBtn').addEventListener('click', (e) => {
  controls.autoRotate = !controls.autoRotate;
  e.currentTarget.setAttribute('aria-pressed', String(controls.autoRotate));
});
$('resetBtn').addEventListener('click', () => flyTo(HOME, 1.4));

function animateCut(toDeg, duration = 1.6) {
  if (reduceMotion) { cutInput.value = toDeg; cell.setCutaway(toDeg * DEG); return; }
  cutAnim = { from: Number(cutInput.value), to: toDeg, t: 0, duration };
}
function stepCut(dt) {
  if (!cutAnim) return;
  cutAnim.t = Math.min(1, cutAnim.t + dt / cutAnim.duration);
  const e = 1 - Math.pow(1 - cutAnim.t, 3);
  const v = cutAnim.from + (cutAnim.to - cutAnim.from) * e;
  cutInput.value = v;
  cell.setCutaway(v * DEG);
  if (cutAnim.t >= 1) cutAnim = null;
}

// ---------------------------------------------------------------- tabs
let mode = 'explore';
const tabs = { explore: $('t-explore'), question: $('t-question'), spot: $('t-spot') };
const panes = { explore: $('p-explore'), question: $('p-question'), spot: $('p-spot') };
function setMode(next) {
  if (mode === next) return;
  if (mode === 'question') pathway.stop();
  mode = next;
  for (const k of Object.keys(tabs)) {
    tabs[k].setAttribute('aria-selected', String(k === next));
    panes[k].hidden = k !== next;
  }
  highlight(null);
  setExploreSelection(null);
  if (next === 'spot') startSpot();
  if (next === 'question' && answered) startExplanation();
  if (next !== 'question') flyTo(HOME, 1.2);
}
Object.entries(tabs).forEach(([k, el]) => el.addEventListener('click', () => setMode(k)));
$('t-explore').parentElement.addEventListener('keydown', (e) => {
  const order = ['explore', 'question', 'spot'];
  const i = order.indexOf(mode);
  if (e.key === 'ArrowRight') { setMode(order[(i + 1) % 3]); tabs[mode].focus(); }
  if (e.key === 'ArrowLeft') { setMode(order[(i + 2) % 3]); tabs[mode].focus(); }
});

function onCellClick(k) {
  if (mode === 'explore') { setExploreSelection(k && ORGANELLES[k] ? k : null, true); }
  else if (mode === 'spot') { if (k && ORGANELLES[k]) answerSpot(k); }
}

// ---------------------------------------------------------------- explore
const LIST_ORDER = ['membrane', 'microvilli', 'nucleus', 'nucleolus', 'rer', 'ribosome', 'ser', 'golgi', 'vesicle',
  'mitochondrion', 'lysosome', 'peroxisome', 'centrosome', 'microtubule', 'actin', 'intermediate'];
const SWATCH = {
  membrane: PALETTE.membraneCut, microvilli: PALETTE.membrane, nucleus: PALETTE.nucleus, nucleolus: PALETTE.nucleolus,
  rer: PALETTE.rer, ribosome: PALETTE.ribosome, ser: PALETTE.ser, golgi: PALETTE.golgiTrans, vesicle: PALETTE.vesicle,
  mitochondrion: PALETTE.mito, lysosome: PALETTE.lysosome, peroxisome: PALETTE.peroxisome, centrosome: PALETTE.centriole,
  microtubule: PALETTE.microtubule, actin: PALETTE.actin, intermediate: PALETTE.intermediate,
};
const listEl = $('organelleList');
const listButtons = {};
for (const k of LIST_ORDER) {
  const li = document.createElement('li');
  const b = document.createElement('button');
  b.type = 'button';
  b.innerHTML = `<span class="swatch" style="background:#${SWATCH[k].toString(16).padStart(6, '0')}"></span>${ORGANELLES[k].name}`;
  b.addEventListener('click', () => setExploreSelection(selected === k ? null : k, true, true));
  li.appendChild(b);
  listEl.appendChild(li);
  listButtons[k] = b;
}

let selected = null;
function setExploreSelection(k, fromUser = false, fromList = false) {
  selected = k;
  for (const [key, b] of Object.entries(listButtons)) b.setAttribute('aria-current', String(key === k));
  $('exploreIntro').hidden = !!k;
  $('exploreDetail').hidden = !k;
  if (mode === 'explore') highlight(k);
  if (!k) return;
  const o = ORGANELLES[k];
  $('dName').textContent = o.name;
  $('dRole').textContent = o.role;
  $('dFacts').innerHTML = o.facts.map((f) => `<li>${f}</li>`).join('');
  if (fromUser) {
    panes.explore.scrollTop = 0;
    if (fromList) focusOn(k);
  }
}
function focusOn(k) {
  const a = cell.organelles[k].anchor;
  if (!a) return;
  controls.autoRotate = false;
  $('spinBtn').setAttribute('aria-pressed', 'false');
  const dir = camera.position.clone().sub(controls.target).normalize();
  flyTo({ target: a.clone().multiplyScalar(0.7), offset: dir.multiplyScalar(9.5) }, 1.2);
}

// ---------------------------------------------------------------- question
let answered = false;
let autoSwitched = false;
$('stem').innerHTML = QUESTION.stem.map((p) => `<p>${p}</p>`).join('');
$('qPrompt').textContent = QUESTION.prompt;
const choicesEl = $('choices');
choicesEl.innerHTML = QUESTION.choices.map((c) => `
  <label class="choice" data-id="${c.id}">
    <input type="radio" name="q" value="${c.id}">
    <span class="letter">${c.id}</span><span>${c.text}</span>
  </label>`).join('');
choicesEl.addEventListener('change', () => { if (!answered) $('submitBtn').disabled = false; });
$('submitBtn').addEventListener('click', submitAnswer);
$('retryBtn').addEventListener('click', resetQuestion);

$('explainText').innerHTML = QUESTION.explanation.map((p) => `<p>${p}</p>`).join('');
$('whyNot').innerHTML = Object.entries(QUESTION.whyNot).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
$('objective').textContent = QUESTION.objective;

function submitAnswer() {
  const chosen = choicesEl.querySelector('input:checked')?.value;
  if (!chosen) return;
  answered = true;
  choicesEl.classList.add('locked');
  choicesEl.querySelectorAll('input').forEach((i) => { i.disabled = true; });
  choicesEl.querySelectorAll('.choice').forEach((c) => {
    if (c.dataset.id === QUESTION.answer) c.classList.add('correct');
    else if (c.dataset.id === chosen) c.classList.add('wrong');
  });
  const ok = chosen === QUESTION.answer;
  const res = $('result');
  res.hidden = false;
  res.className = `result ${ok ? 'ok' : 'no'}`;
  res.textContent = ok ? 'Correct. Now watch the explanation play out in the cell.' : `Not quite. The answer is ${QUESTION.answer}. Watch the explanation play out in the cell.`;
  $('submitBtn').hidden = true;
  $('explain').hidden = false;
  startExplanation();
  res.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
}
function resetQuestion() {
  answered = false;
  autoSwitched = false;
  pathway.stop();
  choicesEl.classList.remove('locked');
  choicesEl.querySelectorAll('input').forEach((i) => { i.disabled = false; i.checked = false; });
  choicesEl.querySelectorAll('.choice').forEach((c) => c.classList.remove('correct', 'wrong'));
  $('result').hidden = true;
  $('explain').hidden = true;
  $('submitBtn').hidden = false;
  $('submitBtn').disabled = true;
  panes.question.scrollTop = 0;
  flyTo(HOME, 1.2);
}

const player = document.querySelector('.player');
const segButtons = player.querySelectorAll('.seg button');
segButtons.forEach((b) => b.addEventListener('click', () => { autoSwitched = true; setPathMode(b.dataset.mode); }));
function setPathMode(m) {
  segButtons.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === m)));
  player.classList.toggle('disease', m === 'disease');
  pathway.setMode(m);
  renderSteps();
  pathway.go(0);
}
function startExplanation() {
  if (Number(cutInput.value) < 45) animateCut(54, 1);
  segButtons.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === 'normal')));
  player.classList.remove('disease');
  pathway.start('normal');
  renderSteps();
  onPathStep(0, pathway.steps[0]);
}
function renderSteps() {
  $('steps').innerHTML = pathway.steps.map((s, i) => `<li><button type="button" data-i="${i}">${s.title}</button></li>`).join('');
  $('steps').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { pathway.go(Number(b.dataset.i)); }));
  markSteps();
}
function markSteps() {
  $('steps').querySelectorAll('button').forEach((b, i) => {
    b.classList.toggle('now', i === pathway.index);
    b.classList.toggle('done', i < pathway.index);
    if (i === pathway.index) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
  });
}
function onPathStep(i, step) {
  if (!pathway.active) return;
  $('capTitle').textContent = step.title;
  $('capBody').textContent = step.body;
  markSteps();
  updatePlayButton();
  flyTo(step.focus(), 1.6);
  controls.autoRotate = false;
  $('spinBtn').setAttribute('aria-pressed', 'false');
  // After the normal route finishes once, roll straight into the disease.
  if (pathway.mode === 'normal' && i === pathway.steps.length - 1 && !pathway.playing && !autoSwitched) {
    autoSwitched = true;
    setTimeout(() => { if (mode === 'question' && pathway.active && pathway.mode === 'normal') setPathMode('disease'); }, 900);
  }
}
function updatePlayButton() {
  const atEnd = pathway.index === pathway.steps.length - 1 && pathway.t >= 1 && !pathway.playing;
  $('playBtn').textContent = atEnd ? 'Replay' : pathway.playing ? 'Pause' : 'Play';
}
$('playBtn').addEventListener('click', () => { pathway.togglePlay(); updatePlayButton(); });
$('prevBtn').addEventListener('click', () => pathway.go(pathway.index - 1));
$('nextBtn').addEventListener('click', () => pathway.go(pathway.index + 1));

const pathway = new Pathway({ scene, cell, labels, onStep: onPathStep });

// ---------------------------------------------------------------- spot it
let spotIndex = 0, spotScore = 0, spotTried = false, spotSolved = false;
function startSpot() {
  spotIndex = 0; spotScore = 0;
  showSpot();
}
function showSpot() {
  spotTried = false; spotSolved = false;
  highlight(null);
  const fb = $('spotFeedback');
  fb.hidden = true;
  $('spotNext').hidden = true;
  $('spotInstr').hidden = false;
  if (spotIndex >= SPOT_IT.length) {
    $('spotMeta').textContent = 'Done';
    $('spotPrompt').innerHTML = `<span class="score">${spotScore} / ${SPOT_IT.length}</span>right on the first click.`;
    $('spotInstr').hidden = true;
    $('spotNext').textContent = 'Start over';
    $('spotNext').hidden = false;
    return;
  }
  $('spotMeta').textContent = `Prompt ${spotIndex + 1} of ${SPOT_IT.length}`;
  $('spotPrompt').textContent = SPOT_IT[spotIndex].prompt;
  $('spotNext').textContent = spotIndex === SPOT_IT.length - 1 ? 'See score' : 'Next prompt';
}
function answerSpot(k) {
  if (spotSolved || spotIndex >= SPOT_IT.length) return;
  const item = SPOT_IT[spotIndex];
  const fb = $('spotFeedback');
  fb.hidden = false;
  if (k === item.answer) {
    if (!spotTried) spotScore++;
    spotSolved = true;
    highlight(k, 'ok');
    fb.className = 'spot-feedback ok';
    fb.innerHTML = `<strong>Yes, the ${ORGANELLES[k].name.toLowerCase()}.</strong>${item.feedback}`;
    $('spotNext').hidden = false;
    $('spotInstr').hidden = true;
  } else {
    spotTried = true;
    highlight(k, 'no');
    fb.className = 'spot-feedback no';
    fb.innerHTML = `<strong>That is the ${ORGANELLES[k].name.toLowerCase()}.</strong>Try another structure.`;
  }
}
$('spotNext').addEventListener('click', () => {
  if (spotIndex >= SPOT_IT.length) { startSpot(); return; }
  spotIndex++;
  showSpot();
});

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  stepFlight(dt);
  stepCut(dt);
  pathway.update(dt);
  if (pathway.active && pathway.playing === false) updatePlayButton();
  controls.update(dt);
  processHover();
  pipeline.render(dt);
  updateLabels();
  requestAnimationFrame(frame);
}

// Opening moment: the cell appears closed, then the cutaway swings open.
const still = new URLSearchParams(location.search).has('still'); // for screenshots
cutInput.value = still ? 54 : 0;
cell.setCutaway(still ? 54 * DEG : 0);
if (still) { controls.autoRotate = false; $('spinBtn').setAttribute('aria-pressed', 'false'); }
renderer.compile(scene, camera);
$('loading').classList.add('done');
if (!still) setTimeout(() => animateCut(54, 2.2), 450);
frame();

// Deep links: #question or #spot open those tabs.
const hash = location.hash.replace('#', '');
if (hash === 'question' || hash === 'spot') setMode(hash);

window.__cell = { cell, camera, controls, pathway, setMode, flyTo, highlight, pipeline, renderer, scene };
