import * as THREE from 'three';

/* ============================================================
   共享常量 / 工具
   ============================================================ */
export const TAU = Math.PI * 2;
export const SPEED = 20.0;              // 列车速度（米/秒）
export const CAR_LEN = 18.0;
export const CAR_GAP = 1.15;
export const CAR_COUNT = 5;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const rand = (a, b) => a + Math.random() * (b - a);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

/* ============================================================
   现实时间 -> 天空 / 海水调色板
   每帧只做插值，不重新分配对象
   ============================================================ */
const KEYS = [
  { h: 0.0,  zen: '#050a1c', hor: '#121b36', sun: '#9db4e8', deep: '#031019', shal: '#0a2b38', cloud: '#1a2440' },
  { h: 4.6,  zen: '#0b1330', hor: '#2c2c4e', sun: '#ffb490', deep: '#041019', shal: '#0a2a36', cloud: '#252c4a' },
  { h: 6.2,  zen: '#29457c', hor: '#e2996c', sun: '#ffbd88', deep: '#061a25', shal: '#104150', cloud: '#7a6270' },
  { h: 8.0,  zen: '#1a63ae', hor: '#9fd0e4', sun: '#fff2d6', deep: '#05202c', shal: '#0d4c58', cloud: '#dfe8ee' },
  { h: 12.0, zen: '#1466bb', hor: '#a9d9ec', sun: '#ffffff', deep: '#04232f', shal: '#0c5661', cloud: '#f2f7fa' },
  { h: 16.5, zen: '#2364ac', hor: '#edcfa4', sun: '#ffe4b5', deep: '#07212c', shal: '#10515b', cloud: '#f0e2cf' },
  { h: 18.3, zen: '#354a82', hor: '#ff8f58', sun: '#ff9f5f', deep: '#071722', shal: '#123d4b', cloud: '#b87f78' },
  { h: 19.6, zen: '#152146', hor: '#6d4763', sun: '#e28d83', deep: '#040f19', shal: '#0a2734', cloud: '#493a58' },
  { h: 21.5, zen: '#050a1c', hor: '#121b36', sun: '#9db4e8', deep: '#031019', shal: '#0a2b38', cloud: '#1a2440' },
  { h: 24.0, zen: '#050a1c', hor: '#121b36', sun: '#9db4e8', deep: '#031019', shal: '#0a2b38', cloud: '#1a2440' },
].map(k => ({
  h: k.h,
  zen: new THREE.Color(k.zen),
  hor: new THREE.Color(k.hor),
  sun: new THREE.Color(k.sun),
  deep: new THREE.Color(k.deep),
  shal: new THREE.Color(k.shal),
  cloud: new THREE.Color(k.cloud),
}));

export const palette = {
  zen: new THREE.Color(),
  hor: new THREE.Color(),
  sun: new THREE.Color(),
  deep: new THREE.Color(),
  shal: new THREE.Color(),
  cloud: new THREE.Color(),
  fog: new THREE.Color(),
  night: 0,
};

export function samplePalette(hour) {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const f = clamp((h - a.h) / (b.h - a.h || 1), 0, 1);
  const e = f * f * (3 - 2 * f);

  palette.zen.copy(a.zen).lerp(b.zen, e);
  palette.hor.copy(a.hor).lerp(b.hor, e);
  palette.sun.copy(a.sun).lerp(b.sun, e);
  palette.deep.copy(a.deep).lerp(b.deep, e);
  palette.shal.copy(a.shal).lerp(b.shal, e);
  palette.cloud.copy(a.cloud).lerp(b.cloud, e);
  palette.fog.copy(palette.hor).lerp(palette.zen, 0.28);

  const elev = Math.sin(((h - 6) / 12) * Math.PI);
  palette.night = 1 - smoothstep(-0.12, 0.2, elev);
  return elev;
}

/* 太阳/月亮方向：始终偏向海面正前方（-Z），方便水面拉出光带。
   同时把白天的仰角压到镜头能看到的高度，避免正午太阳跑到画面外。 */
export function sunDirection(hour, out = new THREE.Vector3()) {
  const theta = ((hour - 6) / 12) * Math.PI;
  const y = Math.sin(theta);
  const vy = y > 0 ? Math.min(y, 0.12) : y;
  return out.set(-0.35 + Math.cos(theta) * 0.38, vy, -0.8).normalize();
}

export function moonDirection(hour, out = new THREE.Vector3()) {
  const mh = ((hour - 18) % 24 + 24) % 24;
  const theta = (mh / 12) * Math.PI;
  const y = Math.sin(theta) * 0.82 + 0.05;
  const vy = y > 0 ? Math.min(y, 0.12) : y;
  return out.set(-0.35 + Math.cos(theta) * 0.32, vy, -0.82).normalize();
}
