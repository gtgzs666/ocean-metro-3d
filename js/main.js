import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import {
  SPEED, CAR_LEN, CAR_GAP, CAR_COUNT, clamp, samplePalette, palette,
  sunDirection, moonDirection, smoothstep,
} from './palette.js';
import { createSky } from './sky.js';
import { createWater } from './water.js';
import { createTrain } from './train.js';
import { createStationSystem } from './station.js';
import { createProps } from './props.js';
import { createScenerySystem } from './scenery.js';
import { createCatenary } from './catenary.js';
import { createSpray } from './spray.js';
import { createWeather } from './weather.js';

/* ============================================================
   基础环境
   ============================================================ */
const canvas = document.createElement('canvas');
canvas.id = 'scene';
document.body.insertBefore(canvas, document.body.firstChild);

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    stencil: false,
  });
} catch (err) {
  document.getElementById('err').style.display = 'flex';
  document.getElementById('veil').classList.add('gone');
  throw err;
}

const DPR = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(DPR);
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x8899aa, 0.0008);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.5, 20000);
camera.position.set(0, 9.6, 46);

/* ============================================================
   时间：默认跟随现实时间，T 键进入加速
   ============================================================ */
const realNow = new Date();
const realHour = realNow.getHours() + realNow.getMinutes() / 60 + realNow.getSeconds() / 3600;
let virtualHour = realHour;
let fastTime = false;
let hourPinned = false;

samplePalette(virtualHour);

/* ============================================================
   天空 / 海面 / 列车 / 车站 / 浮标
   ============================================================ */
const sky = createSky(renderer);
scene.add(sky.group);

const water = createWater(renderer, scene, camera);

const train = createTrain(renderer);
scene.add(train.group);

const stationSystem = createStationSystem(scene);
stationSystem.spawn(300);

const props = createProps(scene);
const scenery = createScenerySystem(scene);
const catenary = createCatenary(scene);
const spray = createSpray(scene);
const weather = createWeather(scene, camera);

/* ============================================================
   灯光
   ============================================================ */
const sunLight = new THREE.DirectionalLight(0xffffff, 2.4);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.left = -95;
sunLight.shadow.camera.right = 95;
sunLight.shadow.camera.top = 95;
sunLight.shadow.camera.bottom = -95;
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 420;
sunLight.shadow.bias = -0.00035;
sunLight.shadow.normalBias = 0.035;
scene.add(sunLight);
scene.add(sunLight.target);
sunLight.target.position.set(0, 2, 0);

const hemi = new THREE.HemisphereLight(0x99bbdd, 0x0a2a33, 0.5);
scene.add(hemi);

const fillLight = new THREE.DirectionalLight(0xacc6dd, 0.3);
fillLight.position.set(26, 14, 40);
scene.add(fillLight);

const moonColor = new THREE.Color(0x9db8e8);

/* ============================================================
   后期：泛光 + 暗角 + 轻微锐化 + 纸颗粒
   ============================================================ */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uTexel: { value: new THREE.Vector2(1 / 1280, 1 / 720) },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uTexel;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7)) + uTime) * 43758.5453123);
    }

    void main() {
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      float r2 = dot(c, c);

      vec3 col = texture2D(tDiffuse, uv).rgb;

      /* 轻微 unsharp mask，抵掉后期叠加带来的软边 */
      vec3 blur = texture2D(tDiffuse, uv + vec2(uTexel.x, 0.0)).rgb;
      blur += texture2D(tDiffuse, uv - vec2(uTexel.x, 0.0)).rgb;
      blur += texture2D(tDiffuse, uv + vec2(0.0, uTexel.y)).rgb;
      blur += texture2D(tDiffuse, uv - vec2(0.0, uTexel.y)).rgb;
      blur *= 0.25;
      col += (col - blur) * 0.18;

      /* 平涂感：提饱和 / 轻微色阶化 / 暖纸色 */
      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(lum), col, 1.22);
      col = max(col - 0.006, 0.0) * 1.035;
      col = pow(col, vec3(1.02));
      col = floor(col * 72.0 + 0.5) / 72.0;

      col = mix(col, col * vec3(1.025, 1.0, 0.972), 0.6);

      float vig = smoothstep(0.88, 0.16, length(c) * 1.3);
      col *= mix(0.72, 1.0, vig);

      /* 极轻的纸纹，避免看起来像被降噪糊过 */
      float grain = hash(uv * 1024.0);
      float fiber = hash(floor(uv * vec2(420.0, 680.0)));
      col += (grain - 0.5) * 0.006 + (fiber - 0.5) * 0.003;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

const composerRT = new THREE.WebGLRenderTarget(
  window.innerWidth,
  window.innerHeight,
  { type: THREE.HalfFloatType, samples: 4 }
);
const composer = new EffectComposer(renderer, composerRT);
composer.setPixelRatio(DPR);
composer.setSize(window.innerWidth, window.innerHeight);

composer.addPass(new RenderPass(scene, camera));

const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.36, 0.42, 0.92
);
composer.addPass(bloom);

const gradePass = new ShaderPass(GradeShader);
gradePass.uniforms.uTexel.value.set(1 / (window.innerWidth * DPR), 1 / (window.innerHeight * DPR));
composer.addPass(gradePass);

composer.addPass(new OutputPass());

/* ============================================================
   HUD
   ============================================================ */
const timeEl = document.getElementById('time');
const phaseEl = document.getElementById('phase');
const weatherEl = document.getElementById('weather');
const subEl = document.getElementById('subtitle');
const hintEl = document.getElementById('hint');
const veil = document.getElementById('veil');

let subTimer = 0;
function showSubtitle(cn, en, dur = 4.2) {
  subEl.innerHTML = cn + '<span class="en">' + en + '</span>';
  subEl.classList.add('show');
  subTimer = dur;
}

let lastClock = '';
function updateClock(elev, hour) {
  const hh = Math.floor(hour) % 24;
  const mm = Math.floor((hour % 1) * 60);
  const key = hh + ':' + mm;
  if (key !== lastClock) {
    lastClock = key;
    timeEl.textContent = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }

  let phase = '夜行';
  if (elev > 0.28) phase = hh < 10 ? '清晨' : (hh < 15 ? '白昼' : '斜阳');
  else if (elev > 0.02) phase = hh < 12 ? '黎明' : '黄昏';
  else if (elev > -0.12) phase = hh < 12 ? '拂晓' : '薄暮';
  phaseEl.textContent = phase;
}

let lastWeatherText = '';
function updateWeatherHud() {
  const w = weather.state;
  const temp = Number.isFinite(w.temp) ? Math.round(w.temp) + '°C' : '';
  const label = w.loaded ? w.label : (w.error ? '天气暂缺' : '天气加载中');
  const text = '新加坡 · ' + label + (temp ? ' ' + temp : '');
  if (text !== lastWeatherText) {
    lastWeatherText = text;
    weatherEl.textContent = text;
  }
}

window.addEventListener('keydown', (e) => {
  if (e.key === 't' || e.key === 'T') {
    fastTime = !fastTime;
    if (fastTime) {
      showSubtitle('时间流速 · 加速', 'TIME SCALE ×960 · REAL DAY IN 90s', 3.0);
      hintEl.textContent = 'T · 回到现实时间　　鼠标 · 视角';
    } else {
      showSubtitle('时间流速 · 现实', 'SYNCED TO LOCAL TIME', 2.6);
      hintEl.textContent = 'T · 时间流速　　鼠标 · 视角';
    }
  }
});

/* 鼠标视差 */
const pointer = { x: 0, y: 0 };
const pointerSmooth = { x: 0, y: 0 };
window.addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
});

/* ============================================================
   车站播报
   ============================================================ */
function onStationEvent(type, info) {
  if (type === 'pass') {
    showSubtitle('正在通过 · ' + info.n + '站', 'PASSING — ' + info.r, 3.8);
  } else if (type === 'next') {
    showSubtitle('下一站 · ' + info.n + '站', 'NEXT — ' + info.r, 4.8);
  }
}

/* ============================================================
   主循环
   ============================================================ */
const clock = new THREE.Clock();
const sunDir = new THREE.Vector3();
const moonDir = new THREE.Vector3();
const lightDir = new THREE.Vector3();
const _weatherFog = new THREE.Color();
const _weatherHazeColor = new THREE.Color(0x87939a);

/* ------------------------------------------------------------
   构图：车头停在画面 2/3 处，车身向左侧画外延伸（不露车尾）
   开场从“车头刚好在左边缘”横移到最终构图
   ------------------------------------------------------------ */
const CAM_Z = 26;
const CAM_Y = 9.6;
const CAM_SIDE = 18;             // 镜头横向偏移，形成 3/4 视角
const NOSE_X = (CAR_COUNT - 1) * 0.5 * (CAR_LEN + CAR_GAP) + CAR_LEN / 2 + 1.35;
const INTRO_DURATION = 10;
let focusTarget = NOSE_X;
let introFrom = NOSE_X;
let viewHalfWidth = 31.25;

function updateFraming() {
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const tan = Math.tan(hFov / 2);
  const L2 = CAM_SIDE * CAM_SIDE + CAM_Z * CAM_Z;
  viewHalfWidth = tan * Math.sqrt(L2);

  /* 3/4 视角下用透视投影反推：车头在 2/3 处，开场在左边缘 */
  const uFinal = (tan * L2) / (3 * CAM_Z + tan * CAM_SIDE);
  const uLeft = -(tan * L2) / (CAM_Z - tan * CAM_SIDE);
  focusTarget = NOSE_X - uFinal;
  introFrom = NOSE_X - uLeft;
}
updateFraming();

let elapsed = 0;
let firstFrame = true;

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  updateFraming();

  const ratio = DPR * renderScale;
  renderer.setPixelRatio(ratio);
  renderer.setSize(w, h, false);

  composer.setPixelRatio(ratio);
  composer.setSize(w, h);

  gradePass.uniforms.uTexel.value.set(1 / (w * ratio), 1 / (h * ratio));
  water.resize();
}
window.addEventListener('resize', resize);

/* ============================================================
   Esc 暂停 + 画面设置
   ============================================================ */
const SETTINGS_KEY = 'sea-metro-settings-v1';
const DEFAULT_SETTINGS = { fps: 60, scale: 1, shadows: 'high', bloom: true, reflection: true, sound: true };
let settings = { ...DEFAULT_SETTINGS };

try {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (raw) settings = { ...settings, ...JSON.parse(raw) };
} catch (err) { /* localStorage 不可用时用默认值 */ }

settings.fps = [0, 30, 60, 120].includes(Number(settings.fps)) ? Number(settings.fps) : 60;
settings.scale = [0.5, 0.75, 1].includes(Number(settings.scale)) ? Number(settings.scale) : 1;
if (!['off', 'low', 'mid', 'high'].includes(settings.shadows)) settings.shadows = 'high';
settings.bloom = settings.bloom !== false;
settings.reflection = settings.reflection !== false;
settings.sound = settings.sound !== false;

let renderScale = settings.scale;
let fpsLimit = settings.fps;
let paused = false;
let frameAccum = 0;
let fpsFrames = 0;
let fpsLast = performance.now();

const settingsEl = document.getElementById('settings');
const settingsClose = document.getElementById('settings-close');
const optFps = document.getElementById('set-fps');
const optScale = document.getElementById('set-scale');
const optShadows = document.getElementById('set-shadows');
const optBloom = document.getElementById('set-bloom');
const optReflection = document.getElementById('set-reflection');
const optSound = document.getElementById('set-sound');
const fpsRead = document.getElementById('set-fps-read');

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (err) { /* ignore */ }
}

function applyShadows() {
  const q = settings.shadows;
  const enabled = q !== 'off';
  renderer.shadowMap.enabled = enabled;
  sunLight.castShadow = enabled;

  if (sunLight.shadow.map) {
    sunLight.shadow.map.dispose();
    sunLight.shadow.map = null;
  }
  if (enabled) {
    const sizes = { low: 512, mid: 1024, high: 2048 };
    const size = sizes[q] || 2048;
    sunLight.shadow.mapSize.set(size, size);
    renderer.shadowMap.type = q === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    renderer.shadowMap.needsUpdate = true;
  }
}

function applyBloom() {
  bloom.enabled = settings.bloom;
}

function applyReflection() {
  water.setReflectionEnabled(settings.reflection);
}

function syncSettingsUi() {
  optFps.value = String(settings.fps);
  optScale.value = String(settings.scale);
  optShadows.value = settings.shadows;
  optBloom.value = settings.bloom ? 'on' : 'off';
  optReflection.value = settings.reflection ? 'on' : 'off';
  optSound.value = settings.sound ? 'on' : 'off';
}

function applySettings() {
  renderScale = settings.scale;
  fpsLimit = settings.fps;
  resize();
  applyShadows();
  applyBloom();
  applyReflection();
  weather.setSoundEnabled(settings.sound);
  syncSettingsUi();
}

function setPaused(value) {
  paused = !!value;
  frameAccum = 0;
  settingsEl.classList.toggle('open', paused);
  settingsEl.setAttribute('aria-hidden', String(!paused));
  if (!paused) {
    clock.getDelta();
    fpsFrames = 0;
    fpsLast = performance.now();
  }
}

/* 暂停时如果改了画质设置，重画一帧作为设置页背景 */
function renderPausedFrame() {
  if (!paused) return;
  renderer.shadowMap.needsUpdate = true;
  water.renderReflection();
  composer.render();
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    setPaused(!paused);
  }
});

settingsClose.addEventListener('click', () => setPaused(false));

optFps.addEventListener('change', () => {
  settings.fps = Number(optFps.value);
  fpsLimit = settings.fps;
  saveSettings();
});

optScale.addEventListener('change', () => {
  settings.scale = Number(optScale.value);
  renderScale = settings.scale;
  saveSettings();
  resize();
  renderPausedFrame();
});

optShadows.addEventListener('change', () => {
  settings.shadows = optShadows.value;
  saveSettings();
  applyShadows();
  renderPausedFrame();
});

optBloom.addEventListener('change', () => {
  settings.bloom = optBloom.value === 'on';
  saveSettings();
  applyBloom();
  renderPausedFrame();
});

optReflection.addEventListener('change', () => {
  settings.reflection = optReflection.value === 'on';
  saveSettings();
  applyReflection();
  renderPausedFrame();
});

optSound.addEventListener('change', () => {
  settings.sound = optSound.value === 'on';
  saveSettings();
  weather.setSoundEnabled(settings.sound);
});

function animate() {
  requestAnimationFrame(animate);

  const rawDt = clock.getDelta();
  if (paused) return;

  frameAccum += rawDt;
  if (fpsLimit > 0 && frameAccum < 1 / fpsLimit - 0.0015) return;

  const dt = Math.min(frameAccum, 0.05);
  frameAccum = 0;
  elapsed += dt;

  fpsFrames++;
  const nowMs = performance.now();
  if (nowMs - fpsLast >= 500) {
    const fps = Math.round(fpsFrames * 1000 / (nowMs - fpsLast));
    if (fpsRead) fpsRead.textContent = fps + ' FPS';
    fpsFrames = 0;
    fpsLast = nowMs;
  }

  /* --- 时间推进 --- */
  if (fastTime) {
    hourPinned = false;
    virtualHour += dt * (24 / 90);
    if (virtualHour >= 24) virtualHour -= 24;
  } else if (!hourPinned) {
    const now = new Date();
    const target = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
    let diff = ((target - virtualHour + 12) % 24 + 24) % 24 - 12;
    virtualHour += diff * Math.min(1, dt * 1.4);
    virtualHour = ((virtualHour % 24) + 24) % 24;
  }

  const elev = samplePalette(virtualHour);
  sunDirection(virtualHour, sunDir);
  moonDirection(virtualHour, moonDir);

  const useSun = elev > 0.015;
  lightDir.copy(useSun ? sunDir : moonDir);

  sunLight.color.copy(useSun ? palette.sun : moonColor);
  sunLight.intensity = useSun
    ? (0.16 + smoothstep(-0.02, 0.3, elev) * 1.75)
    : 0.26;
  sunLight.position.copy(lightDir).multiplyScalar(190);
  sunLight.position.y += 2;

  hemi.color.copy(palette.hor);
  hemi.intensity = 0.24 + (1 - palette.night) * 0.5;
  fillLight.color.copy(palette.hor).lerp(new THREE.Color(0xffffff), 0.3);
  fillLight.intensity = 0.08 + (1 - palette.night) * 0.3;

  /* --- 新加坡实时天气：压暗光照、压能见度、雾霾色 --- */
  const ws = weather.state;
  weather.update(dt, elapsed);
  const weatherDim = clamp(1 - ws.overcast * 0.42 - ws.rain * 0.35 - ws.haze * 0.22, 0.22, 1);
  sunLight.intensity *= weatherDim;
  hemi.intensity *= 0.72 + 0.28 * weatherDim;
  fillLight.intensity *= weatherDim;

  const vis = clamp(ws.visibility || 10000, 250, 30000);
  scene.fog.density = clamp((3.0 / vis) * (1 + ws.rain * 0.55 + ws.haze * 0.8), 0.00028, 0.014);
  _weatherFog.copy(palette.fog).lerp(_weatherHazeColor, clamp(ws.haze * 0.4 + ws.overcast * 0.18, 0, 0.62));
  scene.fog.color.copy(_weatherFog);
  renderer.setClearColor(_weatherFog, 1);

  /* --- 天空 / 海 / 车 / 风景 --- */
  sky.setWeather(ws);
  sky.setFlash(ws.flash);
  sky.update(elapsed, sunDir, moonDir, palette.night);
  water.update(dt, elapsed, lightDir, palette.night);
  water.setWeatherReflection(clamp(1 - ws.cloud * 0.68 - ws.rain * 0.22, 0.22, 1));

  for (const m of train.windowMats) {
    m.emissiveIntensity = 0.62 + palette.night * 1.3;
  }
  const headlightsOn = virtualHour >= 18 || virtualHour < 6;
  train.setHeadlights(headlightsOn);
  train.update(dt, elapsed, SPEED);
  spray.update(dt, palette.night);
  props.update(dt);
  stationSystem.update(dt, onStationEvent);
  scenery.update(dt);
  catenary.update(dt);

  /* --- 相机：开场横移 + 缓慢漂移 + 鼠标视差 --- */
  pointerSmooth.x += (pointer.x - pointerSmooth.x) * Math.min(1, dt * 1.8);
  pointerSmooth.y += (pointer.y - pointerSmooth.y) * Math.min(1, dt * 1.8);

  const introT = clamp(elapsed / INTRO_DURATION, 0, 1);
  const introEase = 1 - Math.pow(1 - introT, 3);
  const focusX = introFrom + (focusTarget - introFrom) * introEase;
  const introW = smoothstep(0, INTRO_DURATION, elapsed);

  camera.position.set(
    focusX + CAM_SIDE + Math.sin(elapsed * 0.071) * 1.1 * introW + pointerSmooth.x * 2.2 * introW,
    CAM_Y + Math.sin(elapsed * 0.11) * 0.32 * introW - pointerSmooth.y * 1.0 * introW,
    CAM_Z + Math.cos(elapsed * 0.048) * 0.8 * introW
  );
  camera.lookAt(
    focusX + Math.sin(elapsed * 0.043) * 0.55 * introW,
    4.55 + Math.sin(elapsed * 0.09) * 0.08 * introW,
    0
  );

  /* --- 字幕 --- */
  if (subTimer > 0) {
    subTimer -= dt;
    if (subTimer <= 0) subEl.classList.remove('show');
  }

  updateClock(elev, virtualHour);
  updateWeatherHud();
  gradePass.uniforms.uTime.value = elapsed;

  /* --- 反射 & 渲染 --- */
  renderer.shadowMap.needsUpdate = true;
  water.renderReflection();
  composer.render();

  if (firstFrame) {
    firstFrame = false;
    setTimeout(() => veil.classList.add('gone'), 250);
  }
}

/* 调试钩子：控制台里 __sea.setHour(18.4) 可以立刻切换时间 */
window.__sea = {
  setHour: (h) => { fastTime = false; hourPinned = true; virtualHour = ((h % 24) + 24) % 24; },
  unpin: () => { hourPinned = false; },
  spawnStation: (x = 40) => stationSystem.spawn(x),
  advanceStations: (sec = 1) => { stationSystem.update(sec, onStationEvent); },
  spawnScenery: (kind = 'island', x = 60, z = -130) => { scenery.add(kind, x, z); },
  clearScenery: () => { scenery.clear(); },
  skipIntro: () => { elapsed = INTRO_DURATION + 0.2; },
  restartIntro: () => { elapsed = 0.15; },
  setIntroTime: (t) => { elapsed = t; },
  getElapsed: () => elapsed,
  weather: weather,
  forceStorm: (sec = 30) => weather.forceStorm(sec),
  strikeLightning: () => weather.strike(),
  refreshWeather: () => weather.refresh(),
  lowfx: () => {
    renderer.shadowMap.enabled = false;
    water.renderReflection = () => {};
    bloom.enabled = false;
  },
};

applySettings();
animate();
