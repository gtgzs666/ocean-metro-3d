import * as THREE from 'three';
import { palette } from './palette.js';

const skyVert = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const skyFrag = /* glsl */`
precision highp float;
varying vec3 vDir;

uniform vec3  uZenith;
uniform vec3  uHorizon;
uniform vec3  uSunColor;
uniform vec3  uCloudColor;
uniform vec3  uSunDir;
uniform vec3  uMoonDir;
uniform float uNight;
uniform float uTime;
uniform float uCloudBoost;
uniform float uCloudCover;
uniform float uHaze;
uniform float uFlash;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p = p * 2.03 + 17.1;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec3 dir = normalize(vDir);
  float h = clamp(dir.y, 0.0, 1.0);

  /* 基础天空渐变 */
  vec3 col = mix(uHorizon, uZenith, pow(h, 0.36));

  /* 太阳方向的大范围散射 */
  float sunDot = clamp(dot(dir, uSunDir), 0.0, 1.0);
  col += uSunColor * pow(sunDot, 5.0) * 0.26 * (1.0 - uNight * 0.85);
  col += uSunColor * pow(sunDot, 90.0) * 0.55;

  /* 日轮 */
  float sunDisc = smoothstep(0.99955, 0.99982, sunDot);
  sunDisc *= step(0.0, uSunDir.y + 0.015);
  col += uSunColor * sunDisc * 2.6;
  col += uSunColor * pow(sunDot, 260.0) * 0.3;

  /* 月轮与月晕 */
  float moonDot = clamp(dot(dir, uMoonDir), 0.0, 1.0);
  float moonDisc = smoothstep(0.99970, 0.99988, moonDot);
  moonDisc *= step(0.0, uMoonDir.y + 0.02);
  col += vec3(0.78, 0.86, 1.0) * moonDisc * 4.2 * uNight;
  col += vec3(0.48, 0.62, 0.92) * pow(moonDot, 160.0) * 0.5 * uNight;

  /* 星空 */
  if (uNight > 0.015) {
    vec3 sp = dir * 300.0;
    float st = hash31(floor(sp));
    float tw = 0.55 + 0.45 * sin(uTime * 2.3 + st * 61.0);
    float star = smoothstep(0.9968, 0.9994, st) * smoothstep(0.0, 0.16, dir.y);
    float starCloudFade = 1.0 - smoothstep(0.50, 0.95, uCloudCover);
    float starFade = smoothstep(0.86, 1.0, uNight) * starCloudFade;
    col += vec3(0.83, 0.9, 1.0) * star * tw * 2.2 * starFade;
  }

  /* 云层：投影到平面上做 fbm，越靠近地平线越压缩 */
  float hy = dir.y + 0.16;
  vec2 cuv = dir.xz / hy;
  cuv = cuv * 0.45 + vec2(uTime * 0.0045, uTime * 0.0016);
  float base = fbm(cuv);
  float detail = fbm(cuv * 2.2 + 9.0);
  float n = base * 0.7 + detail * 0.3;

  /* 晴空比例严格等于 1 - 云量：云量 97% 时几乎覆盖整个天穹 */
  float threshold = 1.0 - clamp(uCloudCover, 0.0, 1.0);
  float cover = smoothstep(threshold - 0.12, threshold + 0.12, n);
  /* 从地平线一直覆盖到天顶，不再只留一条低空云带 */
  float band = smoothstep(0.002, 0.13, dir.y);
  vec3 cloudCol = mix(uCloudColor * 0.5, uSunColor * 1.45, 0.66 + 0.26 * pow(sunDot, 4.0));
  float shade = smoothstep(0.38, 0.82, fbm(cuv * 1.9 + 31.0));
  cloudCol *= 0.78 + 0.38 * shade;
  cloudCol = mix(cloudCol, uCloudColor * 0.45, uNight * 0.8);
  cloudCol = mix(cloudCol, uCloudColor * 0.5, uCloudBoost * 0.5);
  /* 夜间厚云底抬成灰蓝，避免看起来像“深蓝晴空” */
  vec3 nightDeck = mix(vec3(0.17, 0.20, 0.24), uCloudColor * 0.75, 0.55);
  cloudCol = mix(cloudCol, nightDeck, uNight * uCloudCover * 0.82);
  cloudCol *= 0.64 + 0.62 * shade;
  float cloudMix = clamp(cover * band * (0.55 + uCloudCover * 0.6), 0.0, 1.0);
  col = mix(col, cloudCol, cloudMix);

  /* 云层之后再叠一层淡化的日月光晕；云厚时只留一点透光 */
  float lightFade = 0.36 + 0.64 * (1.0 - clamp(uCloudBoost, 0.0, 1.0));
  float sunHalo = pow(sunDot, 9.0) * 0.07 + pow(sunDot, 90.0) * 0.12;
  float moonHalo = pow(moonDot, 16.0) * 0.11;
  col += uSunColor * sunHalo * lightFade * (1.0 - uNight * 0.72);
  col += vec3(0.62, 0.76, 1.0) * moonHalo * lightFade * uNight;

  /* 雾霾和闪电 */
  vec3 hazeCol = mix(uHorizon, uCloudColor, 0.5);
  col = mix(col, hazeCol, clamp(uHaze * 0.45, 0.0, 0.55));
  col += vec3(0.72, 0.82, 1.0) * uFlash * 0.5;

  /* 贴近海平线的雾带，与水面雾色衔接 */
  col = mix(col, uHorizon, smoothstep(0.05, -0.02, dir.y));

  gl_FragColor = vec4(col, 1.0);
}
`;


/* ============================================================
   手绘感的积云 sprite：贴在远处天际线上，负责“宫崎骏味”
   ============================================================ */
function makeCloudTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const g = c.getContext('2d');

  function puff(x, y, r, a) {
    const grd = g.createRadialGradient(x, y, r * 0.05, x, y, r);
    grd.addColorStop(0.0, 'rgba(255,255,255,' + a + ')');
    grd.addColorStop(0.58, 'rgba(255,255,255,' + a * 0.94 + ')');
    grd.addColorStop(0.82, 'rgba(255,255,255,' + a * 0.5 + ')');
    grd.addColorStop(1.0, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  for (let i = 0; i < 52; i++) {
    const t = rnd();
    const x = 150 + t * 724 + (rnd() - 0.5) * 70;
    const base = 332 + Math.sin(t * Math.PI) * 14;
    const y = base - rnd() * 150 * (0.28 + Math.sin(t * Math.PI) * 0.85);
    const r = 30 + rnd() * 58;
    puff(x, y, r, 0.42 + rnd() * 0.3);
  }
  for (let i = 0; i < 16; i++) {
    const x = 230 + rnd() * 570;
    puff(x, 324 + rnd() * 24, 74 + rnd() * 42, 0.46);
  }

  /* 底部压平一点，像真正的积云 */
  g.globalCompositeOperation = 'destination-out';
  const erase = g.createLinearGradient(0, 340, 0, 430);
  erase.addColorStop(0, 'rgba(0,0,0,0)');
  erase.addColorStop(1, 'rgba(0,0,0,0.95)');
  g.fillStyle = erase;
  g.fillRect(0, 330, 1024, 182);
  g.globalCompositeOperation = 'source-over';

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createCloudLayer() {
  const group = new THREE.Group();
  const tex = makeCloudTexture();

  /* 多团重叠的积云：每团由若干前后/上下错开的 billboard 组成，
     靠透明叠积和暗部做出体积，而不是一张平贴片。 */
  const clusters = [
    { x: -9200, y: 1280, z: -13200, sx: 3800, sy: 950, n: 7 },
    { x: -5600, y: 1620, z: -12800, sx: 3000, sy: 850, n: 6 },
    { x: -2400, y: 1160, z: -13600, sx: 3500, sy: 900, n: 7 },
    { x: 1000,  y: 1480, z: -12600, sx: 3600, sy: 850, n: 7 },
    { x: 4400,  y: 1200, z: -13400, sx: 3800, sy: 950, n: 7 },
    { x: 7900,  y: 1660, z: -12900, sx: 3000, sy: 800, n: 6 },
    { x: 11200, y: 1160, z: -13700, sx: 3200, sy: 850, n: 5 },
    { x: -11600, y: 1500, z: -13000, sx: 3000, sy: 800, n: 5 },
    /* 高空云团：把天顶也盖上 */
    { x: -6000, y: 3300, z: -9200, sx: 4600, sy: 1050, n: 5 },
    { x: 4800, y: 3800, z: -9000, sx: 4600, sy: 1050, n: 5 },
    { x: 0, y: 3000, z: -10200, sx: 5600, sy: 1200, n: 6 },
    { x: 10200, y: 3200, z: -9300, sx: 3800, sy: 900, n: 4 },
    { x: -10800, y: 3500, z: -9600, sx: 3800, sy: 900, n: 4 },
    { x: -4200, y: 2600, z: -8000, sx: 4800, sy: 1000, n: 6 },
    { x: 4300, y: 3000, z: -8200, sx: 4800, sy: 1000, n: 6 },
    { x: 8400, y: 2400, z: -8700, sx: 4200, sy: 900, n: 5 },
    { x: -9000, y: 2800, z: -8500, sx: 4200, sy: 900, n: 5 },
    { x: 0, y: 4200, z: -9500, sx: 5600, sy: 1200, n: 5 },
    { x: -3000, y: 3600, z: -8800, sx: 4600, sy: 1200, n: 3, scale: 2.4 },
    { x: 6200, y: 4000, z: -9000, sx: 4600, sy: 1200, n: 3, scale: 2.4 },
    { x: 0, y: 5200, z: -9600, sx: 5200, sy: 1400, n: 3, scale: 2.8 },
  ];

  const puffs = [];
  for (const c of clusters) {
    for (let i = 0; i < c.n; i++) {
      const baseSX = (c.scale || 1) * (900 + Math.random() * 1900);
      const baseSY = baseSX * (0.34 + Math.random() * 0.24);
      const baseX = c.x + (Math.random() * 2 - 1) * c.sx;
      const baseY = c.y + (Math.random() * 2 - 1) * c.sy;
      const z = c.z + (Math.random() * 2 - 1) * 950;
      const baseO = 0.2 + Math.random() * 0.34;

      const m = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        opacity: baseO,
        depthWrite: false,
        fog: false,
        toneMapped: true,
        alphaTest: 0.06,
      });
      m.rotation = (Math.random() * 2 - 1) * 0.12;

      const sp = new THREE.Sprite(m);
      sp.position.set(baseX, baseY, z);
      sp.scale.set(baseSX, baseSY, 1);
      group.add(sp);

      puffs.push({
        sprite: sp,
        mat: m,
        baseX,
        baseY,
        baseSY,
        baseO,
        coverage: Math.random(),
        shade: 0.68 + Math.random() * 0.32,
      });
    }
  }

  return { group, puffs };
}

const _cloudTint = new THREE.Color();
const _cloudNight = new THREE.Color(0x141c2e);
const _cloudGray = new THREE.Color(0x59636b);
function updateCloudTint(puffs, sunDir, night, overcast) {
  _cloudTint.copy(palette.cloud).lerp(palette.sun, 0.32).multiplyScalar(1.18);
  _cloudTint.lerp(_cloudNight, night * 0.55);
  _cloudTint.lerp(_cloudGray, Math.min(1, overcast * 0.38));
  for (const p of puffs) p.mat.color.copy(_cloudTint).multiplyScalar(p.shade);
}

export function createSky(renderer) {
  const geo = new THREE.SphereGeometry(9000, 72, 40);

  const uniforms = {
    uZenith: { value: palette.zen },
    uHorizon: { value: palette.hor },
    uSunColor: { value: palette.sun },
    uCloudColor: { value: palette.cloud },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
    uNight: { value: 0 },
    uTime: { value: 0 },
    uCloudBoost: { value: 0 },
    uCloudCover: { value: 0 },
    uHaze: { value: 0 },
    uFlash: { value: 0 },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: skyVert,
    fragmentShader: skyFrag,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    toneMapped: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -1000;
  mesh.frustumCulled = false;

  const cloudLayer = createCloudLayer();
  const group = new THREE.Group();
  group.add(mesh);
  group.add(cloudLayer.group);



  /* 环境贴图：单独一个只放天空的场景，定期烘 PMREM */
  const envScene = new THREE.Scene();
  const envMesh = new THREE.Mesh(geo, mat);
  envMesh.frustumCulled = false;
  envScene.add(envMesh);

  const cubeRT = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
  const cubeCam = new THREE.CubeCamera(1, 20000, cubeRT);
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileCubemapShader();
  let envTarget = null;

  function refreshEnv() {
    const prev = renderer.getRenderTarget();
    cubeCam.update(renderer, envScene);
    const next = pmrem.fromCubemap(cubeRT.texture);
    if (envTarget) envTarget.dispose();
    envTarget = next;
    renderer.setRenderTarget(prev);
    return next.texture;
  }

  let weatherOvercast = 0;

  function setWeather(ws) {
    const cloud = Math.min(1, Math.max(0, ws.cloud || 0));
    const overcast = Math.min(1, Math.max(0, ws.overcast || 0));
    const rain = Math.min(1, Math.max(0, ws.rain || 0));
    const haze = Math.min(1, Math.max(0, ws.haze || 0));
    const boost = Math.min(0.95, cloud * 0.55 + overcast * 0.35 + rain * 0.2 + haze * 0.1);
    const skyCover = Math.min(1, Math.max(cloud, overcast * 0.95, rain * 0.85, haze * 0.55));

    uniforms.uCloudBoost.value = boost;
    uniforms.uCloudCover.value = skyCover;
    uniforms.uHaze.value = haze;
    weatherOvercast = Math.min(1, overcast * 0.9 + rain * 0.5 + haze * 0.4);

    const coverage = Math.min(1, 0.06 + skyCover * 1.02);
    const thickness = 1 + overcast * 0.9 + rain * 0.8 + haze * 0.2;
    const opacityMul = 0.72 + skyCover * 0.55 + overcast * 0.2;

    for (const p of cloudLayer.puffs) {
      p.sprite.visible = p.coverage <= coverage;
      p.sprite.scale.y = p.baseSY * thickness;
      p.sprite.position.y = p.baseY - p.baseSY * (thickness - 1) * 0.4;
      p.mat.opacity = Math.min(0.98, p.baseO * opacityMul);
    }
  }

  function setFlash(value) {
    uniforms.uFlash.value = value;
  }

  function update(time, sunDir, moonDir, night) {
    uniforms.uTime.value = time;
    uniforms.uSunDir.value.copy(sunDir);
    uniforms.uMoonDir.value.copy(moonDir);
    uniforms.uNight.value = night;
    updateCloudTint(cloudLayer.puffs, sunDir, night, weatherOvercast);
  }

  return { mesh, group, material: mat, uniforms, update, setWeather, setFlash, refreshEnv };
}
