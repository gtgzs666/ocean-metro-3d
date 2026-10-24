import * as THREE from 'three';
import { SPEED } from './palette.js';
import { toon, addOutline } from './toon.js';

/* ============================================================
   接触网：参考日系铁路的管形门架 / 桁架横梁 / 悬臂定位器
   - 30m 一跨，接触线水平，承力索带垂度，吊弦连接
   - 两侧门架柱带基础、警示带、杆号牌和绝缘子
   ============================================================ */
export function createCatenary(scene) {
  const L = 30;
  const N = 22;
  const X0 = -330;
  const TOTAL = N * L;

  const matPole = toon({ color: 0x8b9798 });
  const matBeam = toon({ color: 0x697677 });
  const matBase = toon({ color: 0x747a75 });
  const matWire = toon({ color: 0x172124 });
  const matIns = toon({ color: 0xe9e4d5 });
  const matPlate = toon({ color: 0xe8e4d8 });
  const matWarn = toon({ color: 0xc9a24a });
  const matDark = toon({ color: 0x293235 });

  const geoPole = new THREE.CylinderGeometry(0.1, 0.18, 8.5, 10);
  const geoBase = new THREE.CylinderGeometry(0.55, 0.7, 1.3, 10);
  const geoCap = new THREE.CylinderGeometry(0.14, 0.14, 0.12, 8);
  const geoBand = new THREE.CylinderGeometry(0.195, 0.2, 0.24, 10);
  const geoPlate = new THREE.BoxGeometry(0.52, 0.72, 0.05);
  const geoPlateBack = new THREE.BoxGeometry(0.58, 0.78, 0.03);
  const geoIns = new THREE.CylinderGeometry(0.09, 0.09, 0.22, 8);
  const geoChord = new THREE.BoxGeometry(0.1, 0.14, 20.2);
  const geoPost = new THREE.BoxGeometry(0.07, 0.45, 0.07);
  const geoDiag = new THREE.BoxGeometry(0.05, 0.62, 0.05);
  const geoContact = new THREE.BoxGeometry(L, 0.035, 0.035);
  const geoDrop = new THREE.BoxGeometry(0.022, 1, 0.022);
  const geoHanger = new THREE.BoxGeometry(0.03, 1, 0.03);

  const up = new THREE.Vector3(0, 1, 0);

  function rod(a, b, radius) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const geo = new THREE.CylinderGeometry(radius, radius, len, 6);
    const mesh = new THREE.Mesh(geo, matBeam);
    mesh.position.copy(a).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(up, dir.normalize());
    return mesh;
  }

  function buildSpan() {
    const g = new THREE.Group();

    /* 两侧管形门架柱 */
    for (const z of [7.5, -12.5]) {
      const base = new THREE.Mesh(geoBase, matBase);
      base.position.set(0, 0.65, z);
      addOutline(base, 0.03);
      g.add(base);

      const pole = new THREE.Mesh(geoPole, matPole);
      pole.position.set(0, 4.25, z);
      pole.castShadow = true;
      addOutline(pole, 0.018);
      g.add(pole);

      const cap = new THREE.Mesh(geoCap, matDark);
      cap.position.set(0, 8.52, z);
      g.add(cap);

      const band = new THREE.Mesh(geoBand, matWarn);
      band.position.set(0, 1.52, z);
      g.add(band);

      if (z > 0) {
        const plateBack = new THREE.Mesh(geoPlateBack, matDark);
        plateBack.position.set(0, 5.6, z + 0.16);
        g.add(plateBack);
        const plate = new THREE.Mesh(geoPlate, matPlate);
        plate.position.set(0, 5.6, z + 0.19);
        addOutline(plate, 0.012);
        g.add(plate);
      }
    }

    /* 桁架横梁：上下弦 + 竖杆 + 斜撑 */
    const chordTop = new THREE.Mesh(geoChord, matBeam);
    chordTop.position.set(0, 8.35, -2.5);
    addOutline(chordTop, 0.016);
    g.add(chordTop);

    const chordBottom = new THREE.Mesh(geoChord, matBeam);
    chordBottom.position.set(0, 7.9, -2.5);
    addOutline(chordBottom, 0.016);
    g.add(chordBottom);

    for (const z of [-10, -4, 2, 7]) {
      const post = new THREE.Mesh(geoPost, matBeam);
      post.position.set(0, 8.125, z);
      g.add(post);
    }
    for (const z of [-7.2, -1.2, 4.6]) {
      const diag = new THREE.Mesh(geoDiag, matBeam);
      diag.position.set(0, 8.125, z);
      diag.rotation.x = z > 0 ? 0.72 : -0.72;
      g.add(diag);
    }

    /* 水平接触线 */
    const contact = new THREE.Mesh(geoContact, matWire);
    contact.position.set(L / 2, 7.0, 0);
    g.add(contact);

    /* 承力索：带垂度的贝塞尔曲线 */
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 7.65, 0),
      new THREE.Vector3(L / 2, 7.33, 0),
      new THREE.Vector3(L, 7.65, 0)
    );
    const messengerGeo = new THREE.TubeGeometry(curve, 14, 0.017, 4, false);
    const messenger = new THREE.Mesh(messengerGeo, matWire);
    g.add(messenger);

    /* 吊弦：从上往下逐渐变短 */
    for (const x of [5, 10, 15, 20, 25]) {
      const t = x / L;
      const top = 7.65 - 0.32 * 4 * t * (1 - t);
      const h = top - 7.0;
      const drop = new THREE.Mesh(geoDrop, matWire);
      drop.scale.y = h;
      drop.position.set(x, 7.0 + h / 2, 0);
      g.add(drop);
    }

    /* 横梁中央的吊柱、绝缘子和定位器 */
    const hanger = new THREE.Mesh(geoHanger, matBeam);
    hanger.scale.y = 0.25;
    hanger.position.set(0.2, 7.775, 0);
    g.add(hanger);

    const hangerIns = new THREE.Mesh(geoIns, matIns);
    hangerIns.position.set(0.2, 7.79, 0);
    g.add(hangerIns);

    const register = new THREE.Mesh(geoHanger, matBeam);
    register.scale.y = 0.9;
    register.position.set(0.2, 7.43, 0);
    g.add(register);

    const registerIns = new THREE.Mesh(geoIns, matIns);
    registerIns.position.set(0.2, 7.25, 0);
    g.add(registerIns);

    /* 从近侧柱伸向接触线的悬臂，带绝缘子 */
    const cantStart = new THREE.Vector3(0.16, 6.7, 7.1);
    const cantEnd = new THREE.Vector3(0.16, 7.35, 0.2);
    const cantilever = rod(cantStart, cantEnd, 0.028);
    g.add(cantilever);

    const cantIns = new THREE.Mesh(geoIns, matIns);
    cantIns.position.set(0.16, 6.78, 6.85);
    cantIns.rotation.x = Math.PI / 2.4;
    g.add(cantIns);

    const steady = new THREE.Mesh(geoHanger, matBeam);
    steady.scale.y = 0.35;
    steady.position.set(0.16, 7.17, 0.2);
    g.add(steady);

    /* 近侧柱上的张力平衡块 */
    for (let i = 0; i < 3; i++) {
      const weight = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.16, 0.12, 8),
        i === 1 ? matDark : matBeam
      );
      weight.position.set(0.34, 4.65 + i * 0.2, 7.25);
      g.add(weight);
    }

    return g;
  }

  const spans = [];
  for (let i = 0; i < N; i++) {
    const g = buildSpan();
    g.position.x = X0 + i * L;
    scene.add(g);
    spans.push(g);
  }

  function update(dt) {
    for (const g of spans) {
      g.position.x -= SPEED * dt;
      if (g.position.x < X0) g.position.x += TOTAL;
    }
  }

  return { update };
}
