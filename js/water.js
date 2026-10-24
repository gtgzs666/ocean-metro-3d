import * as THREE from 'three';
import { palette, SPEED } from './palette.js';

/* 波形：越靠近镜头越细，远处收敛成平静的一条线 */
const waterVert = /* glsl */`
precision highp float;

uniform float uTime;
uniform float uScroll;
uniform float uAmp;

varying vec3  vWorldPos;
varying vec3  vNormalW;
varying float vH;

float waveH(vec2 p) {
  float t = uTime;
  float h = 0.0;
  h += sin(p.x * 0.052 + t * 0.52) * 0.60;
  h += sin(p.x * 0.118 + p.y * 0.036 + t * 0.98) * 0.24;
  h += sin(p.y * 0.205 - t * 0.72 + p.x * 0.048) * 0.16;
  h += sin((p.x * 0.53 + p.y * 0.31) + t * 1.65) * 0.055;
  h += sin((p.x * 1.21 - p.y * 0.84) - t * 2.25) * 0.030;
  return h * uAmp;
}

void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec2 p = wp.xz;
  p.x += uScroll;

  float h0 = waveH(p);
  float hx = waveH(p + vec2(1.0, 0.0));
  float hz = waveH(p + vec2(0.0, 1.0));

  wp.y += h0;

  vWorldPos = wp.xyz;
  vNormalW  = normalize(vec3(h0 - hx, 1.0, h0 - hz));
  vH = h0;

  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const waterFrag = /* glsl */`
precision highp float;

uniform sampler2D uReflection;
uniform vec2  uResolution;
uniform vec3  uLightDir;
uniform vec3  uLightColor;
uniform vec3  uDeep;
uniform vec3  uShallow;
uniform vec3  uFogColor;
uniform vec3  uHorizon;
uniform float uTime;
uniform float uNight;
uniform float uReflectivity;

varying vec3  vWorldPos;
varying vec3  vNormalW;
varying float vH;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
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
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = p * 2.07 + 11.3;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec2 p = vWorldPos.xz;
  float dist = length(cameraPosition - vWorldPos);

  /* ---------- 细碎波纹：叠加在顶点法线上 ---------- */
  vec2 detail = vec2(0.0);
  detail += vec2(
    sin(p.x * 1.30 + uTime * 1.9 + sin(p.y * 0.9)),
    sin(p.y * 1.55 - uTime * 1.6 + sin(p.x * 0.7))
  ) * 0.075;
  detail += vec2(
    sin(p.x * 3.1 - uTime * 2.7),
    sin(p.y * 3.6 + uTime * 2.2)
  ) * 0.030;
  vec2 flow = vec2(uTime * 0.35, -uTime * 0.18);
  detail += vec2(fbm(p * 0.55 + flow), fbm(p * 0.62 - flow)) * 0.24 - 0.12;

  vec3 N = normalize(vNormalW + vec3(detail.x, 0.0, detail.y));

  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float fres = 0.028 + 0.972 * pow(1.0 - ndv, 5.0);

  /* ---------- 平面反射：随波纹和时间扰动，避免死镜面 ---------- */
  vec2 uv = gl_FragCoord.xy / uResolution;
  uv.x = 1.0 - uv.x;   // 修正镜像相机的左右翻转
  float wob = fbm(p * 0.8 + vec2(uTime * 0.05, -uTime * 0.035));
  vec2 ripple = vec2(
    sin(p.y * 1.7 + uTime * 1.35 + wob * 4.2),
    sin(p.x * 2.1 - uTime * 1.05 + wob * 3.4)
  );
  float near = 1.0 - smoothstep(18.0, 210.0, dist);
  vec2 off = vec2(N.x, N.z) * vec2(0.042, 0.10)
           + ripple * mix(0.004, 0.016, near);
  vec2 ruv = clamp(uv + off, vec2(0.002), vec2(0.998));

  /* 近处水面更碎，远处更平；五点采样做出水彩般的柔化 */
  float blur = mix(0.008, 0.0025, smoothstep(18.0, 190.0, dist));
  vec3 refl = texture2D(uReflection, ruv).rgb * 0.36;
  refl += texture2D(uReflection, clamp(ruv + vec2(blur * 0.35, blur), vec2(0.002), vec2(0.998))).rgb * 0.2;
  refl += texture2D(uReflection, clamp(ruv - vec2(blur * 0.35, blur), vec2(0.002), vec2(0.998))).rgb * 0.2;
  refl += texture2D(uReflection, clamp(ruv + vec2(blur * 0.85, -blur * 0.55), vec2(0.002), vec2(0.998))).rgb * 0.12;
  refl += texture2D(uReflection, clamp(ruv - vec2(blur * 0.85, -blur * 0.55), vec2(0.002), vec2(0.998))).rgb * 0.12;

  /* 反射统一压一点饱和度，避免太“镜子” */
  float lum = dot(refl, vec3(0.299, 0.587, 0.114));
  refl = mix(vec3(lum), refl, 1.05);
  refl = mix(refl, refl * vec3(0.62, 0.9, 0.94), 0.48);

  /* ---------- 水体本色 ---------- */
  float heightMix = smoothstep(-0.7, 0.95, vH);
  vec3 base = mix(uDeep, uShallow, heightMix);
  base *= 0.9 + 0.1 * uNight;
  base *= 1.08;

  vec3 col = mix(base, refl, clamp(0.035 + fres * 0.6, 0.0, 0.72) * uReflectivity);

  /* ---------- 阳光 / 月光碎金 ---------- */
  vec3 L = normalize(uLightDir);
  vec3 Hv = normalize(L + V);
  float ndh = max(dot(N, Hv), 0.0);
  float sparkle = pow(ndh, 1500.0) * 10.0 + pow(ndh, 180.0) * 0.35 + pow(ndh, 24.0) * 0.05;
  sparkle *= 0.35 + 1.8 * smoothstep(0.32, 0.78, fbm(p * 2.3 + vec2(uTime * 0.7, -uTime * 0.4)));
  col += uLightColor * sparkle * (1.0 - uNight * 0.65);

  /* ---------- 车尾的白色尾流 ---------- */
  float zLine = 2.35 + max(0.0, -p.x) * 0.055;
  float band = smoothstep(1.35, 0.0, abs(abs(vWorldPos.z) - zLine));
  float along = smoothstep(-105.0, -72.0, p.x) * (1.0 - smoothstep(24.0, 44.0, p.x));
  float churn = smoothstep(0.33, 0.78, fbm(p * vec2(0.55, 1.7) + vec2(uTime * 0.55, 0.0)));
  float wake = band * along * churn;
  float centre = smoothstep(3.4, 0.0, abs(vWorldPos.z))
               * smoothstep(-92.0, -48.0, p.x)
               * (1.0 - smoothstep(-26.0, 4.0, p.x));
  vec3 foamCol = mix(vec3(0.86, 0.93, 0.96), vec3(0.28, 0.36, 0.42), uNight * 0.6);
  col = mix(col, foamCol, clamp(wake * 0.34 + centre * 0.12, 0.0, 0.7));

  /* 波峰白沫，克制一点 */
  float crest = smoothstep(0.62, 0.95, vH) * smoothstep(0.55, 0.85, fbm(p * 1.4 + uTime * 0.25));
  col = mix(col, foamCol * 0.85, crest * 0.16);

  /* ---------- 雾 ---------- */
  float fog = 1.0 - exp(-pow(dist * 0.0008, 2.0));
  col = mix(col, uFogColor, clamp(fog, 0.0, 0.985));

  /* 二渲三：轻微色阶化 + 提饱和，反射更像手绘 */
  float wlum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(wlum), col, 1.1);
  col = floor(col * 64.0 + 0.5) / 64.0;

  gl_FragColor = vec4(col, 1.0);
}
`;

export function createWater(renderer, scene, camera) {
  /* 非线性网格：近处密、远处疏，一张平面铺到海平线 */
  const SEG = 620;
  const EXTENT = 4500;
  const geo = new THREE.PlaneGeometry(2, 2, SEG, SEG);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i);
    const v = pos.getY(i);
    const x = Math.sign(u) * Math.pow(Math.abs(u), 1.7) * EXTENT;
    const y = Math.sign(v) * Math.pow(Math.abs(v), 1.7) * EXTENT;
    pos.setXY(i, x, y);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.rotateX(-Math.PI / 2);

  const uniforms = {
    uTime: { value: 0 },
    uScroll: { value: 0 },
    uAmp: { value: 1.0 },
    uReflection: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uLightDir: { value: new THREE.Vector3(0, 1, 0) },
    uLightColor: { value: palette.sun },
    uDeep: { value: palette.deep },
    uShallow: { value: palette.shal },
    uFogColor: { value: palette.fog },
    uHorizon: { value: palette.hor },
    uNight: { value: 0 },
    uReflectivity: { value: 1 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: waterVert,
    fragmentShader: waterFrag,
    side: THREE.FrontSide,
    fog: false,
  });

  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  scene.add(mesh);

  /* ---------- 平面前面反射 ---------- */
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(
    Math.max(2, Math.floor(size.x * 0.9)),
    Math.max(2, Math.floor(size.y * 0.9)),
    {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
    }
  );
  uniforms.uReflection.value = rt.texture;
  uniforms.uResolution.value.copy(size);

  const virtualCamera = new THREE.PerspectiveCamera();
  virtualCamera.far = camera.far;

  const reflectorPos = new THREE.Vector3(0, 0, 0);
  const normal = new THREE.Vector3(0, 1, 0);
  const camPos = new THREE.Vector3();
  const rotMat = new THREE.Matrix4();
  const lookAt = new THREE.Vector3();
  const clipPlane = new THREE.Vector4();
  const view = new THREE.Vector3();
  const target = new THREE.Vector3();
  const q = new THREE.Vector4();
  const reflectorPlane = new THREE.Plane();

  let scroll = 0;
  let time = 0;
  let reflectionEnabled = true;

  function updateReflectionCamera() {
    camera.updateMatrixWorld();
    reflectorPos.set(0, 0, 0);
    camPos.setFromMatrixPosition(camera.matrixWorld);

    view.subVectors(reflectorPos, camPos);
    if (view.dot(normal) > 0) return false;

    view.reflect(normal).negate().add(reflectorPos);

    rotMat.extractRotation(camera.matrixWorld);
    lookAt.set(0, 0, -1).applyMatrix4(rotMat).add(camPos);
    target.subVectors(reflectorPos, lookAt).reflect(normal).negate().add(reflectorPos);

    virtualCamera.position.copy(view);
    virtualCamera.up.set(0, 1, 0).applyMatrix4(rotMat).reflect(normal);
    virtualCamera.lookAt(target);
    virtualCamera.far = camera.far;
    virtualCamera.updateMatrixWorld();
    virtualCamera.projectionMatrix.copy(camera.projectionMatrix);

    /* 斜切近裁剪面，把水下的东西裁掉 */
    reflectorPlane.setFromNormalAndCoplanarPoint(normal, reflectorPos);
    reflectorPlane.applyMatrix4(virtualCamera.matrixWorldInverse);
    clipPlane.set(
      reflectorPlane.normal.x, reflectorPlane.normal.y, reflectorPlane.normal.z,
      reflectorPlane.constant
    );

    const pm = virtualCamera.projectionMatrix;
    q.x = (Math.sign(clipPlane.x) + pm.elements[8]) / pm.elements[0];
    q.y = (Math.sign(clipPlane.y) + pm.elements[9]) / pm.elements[5];
    q.z = -1.0;
    q.w = (1.0 + pm.elements[10]) / pm.elements[14];
    clipPlane.multiplyScalar(2.0 / clipPlane.dot(q));

    pm.elements[2] = clipPlane.x;
    pm.elements[6] = clipPlane.y;
    pm.elements[10] = clipPlane.z + 1.0;
    pm.elements[14] = clipPlane.w;
    return true;
  }

  function renderReflection() {
    if (!reflectionEnabled) return;
    if (!updateReflectionCamera()) return;
    const prev = renderer.getRenderTarget();
    mesh.visible = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(scene, virtualCamera);
    renderer.setRenderTarget(prev);
    mesh.visible = true;
  }

  function update(dt, elapsed, lightDir, night) {
    scroll += SPEED * dt;
    time = elapsed;
    uniforms.uTime.value = time;
    uniforms.uScroll.value = scroll;
    uniforms.uLightDir.value.copy(lightDir);
    uniforms.uNight.value = night;
  }

  function setReflectionEnabled(on) {
    reflectionEnabled = !!on;
    uniforms.uReflectivity.value = on ? 1 : 0;
  }

  function resize() {
    const s = renderer.getDrawingBufferSize(new THREE.Vector2());
    uniforms.uResolution.value.copy(s);
    rt.setSize(
      Math.max(2, Math.floor(s.x * 0.9)),
      Math.max(2, Math.floor(s.y * 0.9))
    );
  }

  return { mesh, material, uniforms, update, renderReflection, resize, setReflectionEnabled, rt };
}
