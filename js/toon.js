import * as THREE from 'three';

/* ============================================================
   二渲三基础：4 阶明暗梯度 + 反向外壳描边
   ============================================================ */
const gradData = new Uint8Array([
  40, 40, 40, 255,
  104, 104, 104, 255,
  178, 178, 178, 255,
  245, 245, 245, 255,
]);

export const toonGradient = new THREE.DataTexture(gradData, 4, 1, THREE.RGBAFormat);
toonGradient.minFilter = THREE.NearestFilter;
toonGradient.magFilter = THREE.NearestFilter;
toonGradient.generateMipmaps = false;
toonGradient.needsUpdate = true;

export function toon(params = {}) {
  return new THREE.MeshToonMaterial({
    gradientMap: toonGradient,
    ...params,
  });
}

/* 自发光色块：颜色可以超过 1，交给 Bloom */
export function glow(hex, intensity = 1) {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex) });
  m.color.multiplyScalar(intensity);
  return m;
}

/* ---------- 描边 ---------- */
const inkCache = new Map();

function inkMaterial(thickness, hex) {
  const key = thickness.toFixed(3) + '_' + hex;
  if (inkCache.has(key)) return inkCache.get(key);

  const m = new THREE.ShaderMaterial({
    uniforms: {
      uThickness: { value: thickness },
      uColor: { value: new THREE.Color(hex) },
    },
    vertexShader: /* glsl */`
      uniform float uThickness;
      void main() {
        vec3 p = position + normal * uThickness;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      void main() {
        gl_FragColor = vec4(uColor, 1.0);
      }
    `,
    side: THREE.BackSide,
  });
  inkCache.set(key, m);
  return m;
}

export function addOutline(mesh, thickness = 0.05, hex = 0x0b1216) {
  if (!mesh || !mesh.isMesh || mesh.userData.outlined) return;
  const mat = mesh.material;
  if (!mat || mat.transparent) return;
  if (mesh.geometry && mesh.geometry.type === 'PlaneGeometry') return;

  const outline = new THREE.Mesh(mesh.geometry, inkMaterial(thickness, hex));
  outline.castShadow = false;
  outline.receiveShadow = false;
  outline.raycast = () => {};
  outline.userData.isOutline = true;
  mesh.add(outline);
  mesh.userData.outlined = true;
}

/* 给一整组里“够大”的实体加描边，跳过窗户、灯、玻璃 */
export function outlineGroup(root, thickness = 0.05, hex = 0x0b1216) {
  root.traverse((o) => {
    if (!o.isMesh || o.userData.isOutline || o.userData.outlined) return;
    if (o.userData.noOutline) return;
    const mat = o.material;
    if (!mat || mat.transparent) return;
    if (o.geometry && o.geometry.type === 'PlaneGeometry') return;
    if (mat.isMeshBasicMaterial) return;
    addOutline(o, thickness, hex);
  });
}
