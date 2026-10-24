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
  float clearSky = 1.0 - clamp(uCloudBoost, 0.0, 1.0) * 0.82;

  /* 基础天空渐变 */
  vec3 col = mix(uHorizon, uZenith, pow(h, 0.36));

  /* 太阳方向的大范围散射 */
  float sunDot = clamp(dot(dir, uSunDir), 0.0, 1.0);
  col += uSunColor * pow(sunDot, 5.0) * 0.26 * (1.0 - uNight * 0.85) * clearSky;
  col += uSunColor * pow(sunDot, 90.0) * 0.55 * clearSky;

  /* 日轮 */
  float sunDisc = smoothstep(0.99955, 0.99982, sunDot);
  sunDisc *= step(0.0, uSunDir.y + 0.015) * clearSky;
  col += uSunColor * sunDisc * 2.6;
  col += uSunColor * pow(sunDot, 260.0) * 0.3 * clearSky;

  /* 月轮与月晕 */
  float moonDot = clamp(dot(dir, uMoonDir), 0.0, 1.0);
  float moonDisc = smoothstep(0.99970, 0.99988, moonDot);
  moonDisc *= step(0.0, uMoonDir.y + 0.02) * clearSky;
  col += vec3(0.78, 0.86, 1.0) * moonDisc * 4.2 * uNight;
  col += vec3(0.48, 0.62, 0.92) * pow(moonDot, 160.0) * 0.5 * uNight * clearSky;

  /* 星空 */
  if (uNight > 0.015) {
    vec3 sp = dir * 300.0;
    float st = hash31(floor(sp));
    float tw = 0.55 + 0.45 * sin(uTime * 2.3 + st * 61.0);
    float star = smoothstep(0.9968, 0.9994, st) * smoothstep(0.0, 0.16, dir.y);
    float starFade = smoothstep(0.86, 1.0, uNight) * clearSky;
    col += vec3(0.83, 0.9, 1.0) * star * tw * 2.2 * starFade;
  }

  /* 云层：投影到平面上做 fbm，越靠近地平线越压缩 */
  float hy = dir.y + 0.16;
  vec2 cuv = dir.xz / hy;
  cuv = cuv * 0.45 + vec2(uTime * 0.0045, uTime * 0.0016);
  float base = fbm(cuv);
  float detail = fbm(cuv * 2.2 + 9.0);
  float n = base * 0.7 + detail * 0.3;
  float cover = smoothstep(0.50, 0.62, n);
  cover = clamp(cover + uCloudBoost * 0.55, 0.0, 1.0);
  float band = smoothstep(0.015, 0.20, dir.y) * smoothstep(0.92, 0.42, dir.y);
  vec3 cloudCol = mix(uCloudColor * 0.5, uSunColor * 1.45, 0.66 + 0.26 * pow(sunDot, 4.0));
  float shade = smoothstep(0.38, 0.82, fbm(cuv * 1.9 + 31.0));
  cloudCol *= 0.78 + 0.38 * shade;
  cloudCol = mix(cloudCol, uCloudColor * 0.45, uNight * 0.8);
  cloudCol = mix(cloudCol, uCloudColor * 0.5, uCloudBoost * 0.5);
  col = mix(col, cloudCol, cover * band * (0.48 + uCloudBoost * 0.32));

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
  const defs = [
    { x: -8200, y: 1000, z: -12400, sx: 5200, sy: 1850, o: 0.68, r: 0.03 },
    { x: -3500, y: 1550, z: -13100, sx: 3500, sy: 1300, o: 0.58, r: -0.05 },
    { x: 900,   y: 980,  z: -11900, sx: 3200, sy: 1150, o: 0.68,  r: 0.02 },
    { x: 3200,  y: 1250, z: -11200, sx: 6200, sy: 2300, o: 0.8,  r: 0.01 },
    { x: 5400,  y: 1750, z: -13300, sx: 4600, sy: 1600, o: 0.64, r: 0.06 },
    { x: 9600,  y: 1150, z: -12600, sx: 3600, sy: 1300, o: 0.62, r: -0.03 },
    { x: 1200,  y: 2250, z: -13800, sx: 5200, sy: 1700, o: 0.4, r: 0.04 },
  ];

  const mats = [];
  for (const d of defs) {
    const m = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: d.o,
      depthWrite: false,
      fog: false,
      toneMapped: true,
      alphaTest: 0.06,
    });
    m.rotation = d.r;
    m.userData.baseOpacity = d.o;
    const sp = new THREE.Sprite(m);
    sp.position.set(d.x, d.y, d.z);
    sp.scale.set(d.sx, d.sy, 1);
    group.add(sp);
    mats.push(m);
  }

  return { group, mats };
}

const _cloudTint = new THREE.Color();
const _cloudNight = new THREE.Color(0x141c2e);
const _cloudGray = new THREE.Color(0x59636b);
function updateCloudTint(mats, sunDir, night, overcast) {
  _cloudTint.copy(palette.cloud).lerp(palette.sun, 0.32).multiplyScalar(1.18);
  _cloudTint.lerp(_cloudNight, night * 0.55);
  _cloudTint.lerp(_cloudGray, Math.min(1, overcast * 0.38));
  for (const m of mats) m.color.copy(_cloudTint);
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

    uniforms.uCloudBoost.value = boost;
    uniforms.uHaze.value = haze;
    weatherOvercast = Math.min(1, overcast * 0.9 + rain * 0.5 + haze * 0.4);

    for (const m of cloudLayer.mats) {
      const base = m.userData.baseOpacity || 0.6;
      m.opacity = Math.min(1, base * (0.3 + cloud * 1.05));
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
    updateCloudTint(cloudLayer.mats, sunDir, night, weatherOvercast);
  }

  return { mesh, group, material: mat, uniforms, update, setWeather, setFlash, refreshEnv };
}
