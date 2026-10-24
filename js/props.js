import * as THREE from 'three';
import { SPEED, rand } from './palette.js';
import { toon, glow } from './toon.js';

/* ============================================================
   航道浮标 + 远处的岛影：给速度感一点参照
   ============================================================ */
export function createProps(scene) {
  const buoys = [];
  const islands = [];

  const matPole = toon({ color: 0x242a2b });
  const matRed = glow(0xff4530, 3.6);
  const matGreen = glow(0x4dffc0, 3.0);
  const matFloat = toon({ color: 0x35302a });

  const poleGeo = new THREE.CylinderGeometry(0.07, 0.09, 3.1, 8);
  const floatGeo = new THREE.CylinderGeometry(0.5, 0.62, 0.55, 12);
  const lampGeo = new THREE.SphereGeometry(0.2, 12, 8);

  /* 只放在近侧 +16 / 远侧 -20 两条水道，避开列车、站台、电杆和废弃站 */
  const buoyDefs = [
    { x: -380, z: -20 }, { x: -270, z: 16 }, { x: -140, z: -20 },
    { x: -30, z: 16 },   { x: 90, z: -20 },  { x: 210, z: 16 },
    { x: 320, z: -20 },  { x: 430, z: 16 },
  ];

  buoyDefs.forEach((d, i) => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(floatGeo, matFloat);
    base.position.y = 0.1;
    g.add(base);

    const pole = new THREE.Mesh(poleGeo, matPole);
    pole.position.y = 1.75;
    g.add(pole);

    const lamp = new THREE.Mesh(lampGeo, i % 2 ? matGreen : matRed);
    lamp.position.y = 3.4;
    g.add(lamp);

    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.22, 10), matPole);
    cap.position.y = 3.62;
    g.add(cap);

    g.userData.lane = d.z > 0 ? 16 : -20;
    g.position.set(d.x, 0, d.z);
    scene.add(g);
    buoys.push(g);
  });

  /* 远岛：几组压扁的球体，雾里只剩剪影 */
  const matIsland = toon({ color: 0x22363c });
  const geoIsland = new THREE.SphereGeometry(1, 20, 12);
  const islandDefs = [
    { x: -1150, z: -880, s: 260, h: 22 },
    { x: -350, z: -1250, s: 340, h: 30 },
    { x: 900, z: -1020, s: 300, h: 18 },
    { x: 1900, z: -1400, s: 420, h: 36 },
  ];

  islandDefs.forEach(d => {
    const g = new THREE.Group();
    const main = new THREE.Mesh(geoIsland, matIsland);
    main.scale.set(d.s, d.h, d.s * 0.55);
    main.position.y = -d.h * 0.28;
    g.add(main);

    const bump = new THREE.Mesh(geoIsland, matIsland);
    bump.scale.set(d.s * 0.55, d.h * 0.75, d.s * 0.4);
    bump.position.set(d.s * 0.45, -d.h * 0.4, 10);
    g.add(bump);

    g.position.set(d.x, -2, d.z);
    scene.add(g);
    islands.push(g);
  });

  function update(dt) {
    for (const b of buoys) {
      b.position.x -= SPEED * dt;
      b.rotation.z = Math.sin(performance.now() * 0.0012 + b.position.z) * 0.02;
      if (b.position.x < -480) {
        b.position.x += 940;
        b.position.z = b.userData.lane + rand(-2.5, 2.5);
      }
    }
    for (const g of islands) {
      g.position.x -= SPEED * 0.08 * dt;
      if (g.position.x < -6000) g.position.x += 12000;
    }
  }

  return { update, buoys };
}
