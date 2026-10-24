import * as THREE from 'three';
import { SPEED, rand } from './palette.js';
import { toon, glow, addOutline } from './toon.js';

/* ============================================================
   沿线风景：小岛 / 废弃车站 / 海上城镇
   全部二渲三平涂 + 描边，随海面一起向后退
   ============================================================ */

const lowSphere = new THREE.IcosahedronGeometry(1, 1);
lowSphere.computeVertexNormals();
const rockGeo = new THREE.IcosahedronGeometry(1, 0);
rockGeo.computeVertexNormals();
const trunkGeo = new THREE.CylinderGeometry(0.1, 0.15, 1, 6);

/* 用射线找低多边形山体的真实表面，避免树/鸟居/灯塔浮空 */
const _groundRay = new THREE.Raycaster();
const _groundDir = new THREE.Vector3(0, -1, 0);
function groundAt(mesh, x, z, topY) {
  mesh.updateMatrixWorld(true);
  _groundRay.set(new THREE.Vector3(x, topY, z), _groundDir);
  const hit = _groundRay.intersectObject(mesh, false)[0];
  return hit ? hit.point.y : null;
}

const M = {
  rock: toon({ color: 0x3f5854 }),
  sand: toon({ color: 0xb7a17a }),
  hill: toon({ color: 0x5b8463 }),
  hillDark: toon({ color: 0x3f6853 }),
  trunk: toon({ color: 0x4a3529 }),
  leafA: toon({ color: 0x548d5c }),
  leafB: toon({ color: 0x3a6b4d }),
  leafC: toon({ color: 0x6b9a5e }),
  wood: toon({ color: 0x6b4a32 }),
  woodDark: toon({ color: 0x4c3425 }),
  wallA: toon({ color: 0xe9e0ca }),
  wallB: toon({ color: 0xd9cbb2 }),
  wallC: toon({ color: 0xc7b295 }),
  blueWall: toon({ color: 0x9fb8b8 }),
  roofA: toon({ color: 0x3b4d58 }),
  roofB: toon({ color: 0x6b3f42 }),
  roofC: toon({ color: 0x35443f }),
  rust: toon({ color: 0x7a5b43 }),
  rustLight: toon({ color: 0x96714f }),
  metal: toon({ color: 0x596668 }),
  window: glow(0xffc27a, 1.9),
  clock: glow(0xfff0c8, 1.3),
  lantern: glow(0xffd9a0, 2.6),
  dimLamp: glow(0xffbd7a, 0.85),
  torii: toon({ color: 0xb5432f }),
  clothA: toon({ color: 0xd9d2c0 }),
  clothB: toon({ color: 0x7f9ba0 }),
  clothC: toon({ color: 0xb5654f }),
  stone: toon({ color: 0x9a9b8f }),
};

/* 废弃站牌：手写褪色感 */
let abandonedSignTex = null;
function getAbandonedSign() {
  if (abandonedSignTex) return abandonedSignTex;
  const c = document.createElement('canvas');
  c.width = 768;
  c.height = 192;
  const g = c.getContext('2d');
  g.fillStyle = '#24342f';
  g.fillRect(0, 0, c.width, c.height);

  g.strokeStyle = 'rgba(196, 204, 188, 0.35)';
  g.lineWidth = 6;
  g.beginPath();
  g.roundRect(16, 16, c.width - 32, c.height - 32, 6);
  g.stroke();

  g.fillStyle = 'rgba(226, 230, 216, 0.78)';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '600 86px "Noto Sans CJK SC", "Noto Sans SC", sans-serif';
  g.fillText('旧・汐见', c.width / 2, 82);

  g.fillStyle = 'rgba(210, 218, 202, 0.42)';
  g.font = '500 26px "Noto Sans CJK SC", sans-serif';
  g.fillText('ABANDONED STATION', c.width / 2, 148);

  /* 裂纹 */
  g.strokeStyle = 'rgba(10, 20, 16, 0.6)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(540, 20);
  g.lineTo(560, 62);
  g.lineTo(534, 96);
  g.lineTo(556, 172);
  g.stroke();

  abandonedSignTex = new THREE.CanvasTexture(c);
  abandonedSignTex.colorSpace = THREE.SRGBColorSpace;
  abandonedSignTex.anisotropy = 4;
  return abandonedSignTex;
}

function makeTree(rng, h, spread) {
  const g = new THREE.Group();

  const trunk = new THREE.Mesh(trunkGeo, M.trunk);
  trunk.scale.set(spread * 0.2, h * 0.62, spread * 0.2);
  trunk.position.y = h * 0.31;
  g.add(trunk);

  const crowns = 2 + ((rng() * 2) | 0);
  for (let i = 0; i < crowns; i++) {
    const r = spread * (0.55 + rng() * 0.5);
    const leaf = new THREE.Mesh(lowSphere, i % 3 === 0 ? M.leafB : (i % 3 === 1 ? M.leafA : M.leafC));
    leaf.scale.set(r, r * (0.75 + rng() * 0.3), r);
    leaf.position.set(
      (rng() - 0.5) * spread * 0.8,
      h * (0.52 + rng() * 0.25),
      (rng() - 0.5) * spread * 0.8
    );
    leaf.rotation.y = rng() * Math.PI;
    addOutline(leaf, 0.028);
    g.add(leaf);
  }
  return g;
}

function makeHouse(rng, w, h, d, wallMat, roofMat) {
  const g = new THREE.Group();

  /* 高脚屋：柱子在水中 */
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.6, 0.2), M.woodDark);
      post.position.set(sx * w * 0.38, 0.05, sz * d * 0.36);
      g.add(post);
    }
  }

  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  body.position.y = 1.32 + h / 2;
  addOutline(body, 0.022);
  g.add(body);

  const roofH = 1.1 + rng() * 0.9;
  const roofR = Math.sqrt(w * w + d * d) * 0.5 * 1.18;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(roofR, roofH, 4), roofMat);
  roof.position.y = 1.32 + h + roofH / 2;
  roof.rotation.y = Math.PI / 4;
  addOutline(roof, 0.022);
  g.add(roof);

  const door = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.25, 0.08), M.woodDark);
  door.position.set(w * 0.16, 1.32 + 0.63, d / 2 + 0.045);
  g.add(door);

  const winN = 1 + ((rng() * 2) | 0);
  for (let i = 0; i < winN; i++) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.06), M.window);
    win.position.set(
      (i - (winN - 1) / 2) * 1.05 - w * 0.16,
      1.32 + h * 0.58,
      d / 2 + 0.05
    );
    g.add(win);
  }

  if (rng() < 0.6) {
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.95, 0.38), M.stone);
    chimney.position.set(w * 0.28, 1.32 + h + roofH * 0.42, -d * 0.12);
    addOutline(chimney, 0.018);
    g.add(chimney);
  }

  return g;
}

function makeLaundryLine(rng, x0, z0, len) {
  const g = new THREE.Group();
  const h = 3.1;

  for (const x of [x0, x0 + len]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, h, 6), M.woodDark);
    pole.position.set(x, h / 2, z0);
    g.add(pole);
  }
  const line = new THREE.Mesh(new THREE.BoxGeometry(len, 0.025, 0.025), M.metal);
  line.position.set(x0 + len / 2, h - 0.15, z0);
  g.add(line);

  const cloths = [M.clothA, M.clothB, M.clothC];
  for (let i = 0; i < 4; i++) {
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6 + rng() * 0.25, 0.03), cloths[i % 3]);
    cloth.position.set(x0 + 0.8 + i * (len - 1.4) / 3, h - 0.5, z0 + 0.02);
    cloth.rotation.z = (rng() - 0.5) * 0.14;
    g.add(cloth);
  }
  return g;
}

function makeIsland(rng) {
  const s = rand(20, 44);
  const g = new THREE.Group();

  const base = new THREE.Mesh(rockGeo, M.rock);
  base.scale.set(s, s * 0.42, s * 0.62);
  base.position.y = -s * 0.06;
  base.rotation.y = rng() * Math.PI;
  addOutline(base, 0.012);
  g.add(base);

  const sand = new THREE.Mesh(rockGeo, M.sand);
  sand.scale.set(s * 0.94, s * 0.3, s * 0.58);
  sand.position.y = -s * 0.02;
  g.add(sand);

  const hill = new THREE.Mesh(rockGeo, rng() < 0.5 ? M.hill : M.hillDark);
  hill.scale.set(s * 0.8, s * 0.46, s * 0.48);
  hill.position.y = s * 0.06;
  hill.rotation.y = rng() * Math.PI;
  addOutline(hill, 0.012);
  g.add(hill);

  /* 树 */
  const treeN = 3 + ((rng() * 5) | 0);
  for (let i = 0; i < treeN; i++) {
    const x = (rng() - 0.5) * s * 1.0;
    const z = (rng() - 0.5) * s * 0.55;
    const gy = groundAt(hill, x, z, s * 1.2);
    const y = (gy !== null ? gy : s * 0.35) - 0.35;
    const tree = makeTree(rng, 5 + rng() * 5, 1.4 + rng() * 1.4);
    tree.position.set(x, y, z);
    tree.rotation.y = rng() * Math.PI;
    g.add(tree);
  }

  /* 岛上的小神社 / 鸟居 */
  if (rng() < 0.42) {
    const t = new THREE.Group();
    const gyC = groundAt(hill, 0, 0, s * 1.2);
    const gyL = groundAt(hill, -1.7, 0, s * 1.2);
    const gyR = groundAt(hill, 1.7, 0, s * 1.2);
    const baseY = Math.min(
      gyC !== null ? gyC : s * 0.48,
      gyL !== null ? gyL : s * 0.48,
      gyR !== null ? gyR : s * 0.48
    ) - 0.35;
    const tY = baseY + 0.5;

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.5, 1.7), M.stone);
    plinth.position.set(0, baseY + 0.25, 0);
    addOutline(plinth, 0.03);
    g.add(plinth);

    for (const dx of [-1.7, 1.7]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 4.4, 8), M.torii);
      pillar.position.set(dx, tY + 2.2, 0);
      addOutline(pillar, 0.025);
      t.add(pillar);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.34, 0.34), M.torii);
    beam.position.set(0, tY + 4.1, 0);
    addOutline(beam, 0.02);
    t.add(beam);
    const beam2 = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.22, 0.3), M.torii);
    beam2.position.set(0, tY + 3.55, 0);
    t.add(beam2);
    t.rotation.y = (rng() - 0.5) * 0.5;
    g.add(t);
  }

  /* 灯塔 */
  if (rng() < 0.24) {
    const lh = new THREE.Group();
    const lx = -s * 0.28;
    const lz = s * 0.08;
    const points = [
      groundAt(hill, lx, lz, s * 1.2),
      groundAt(hill, lx + 1.6, lz, s * 1.2),
      groundAt(hill, lx - 1.6, lz, s * 1.2),
      groundAt(hill, lx, lz + 1.6, s * 1.2),
      groundAt(hill, lx, lz - 1.6, s * 1.2),
    ].filter((v) => v !== null);
    const baseY = Math.min(...(points.length ? points : [s * 0.4])) - 0.35;

    const foundation = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 1.0, 10), M.stone);
    foundation.position.set(lx, baseY + 0.5, lz);
    addOutline(foundation, 0.03);
    g.add(foundation);

    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.7, 10, 10), M.wallA);
    tower.position.y = 5;
    addOutline(tower, 0.02);
    lh.add(tower);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 1.4, 10), M.torii);
    band.position.y = 8.2;
    lh.add(band);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.05, 0.35, 10), M.roofA);
    top.position.y = 10.2;
    lh.add(top);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), M.lantern);
    lamp.position.y = 10.55;
    lh.add(lamp);
    lh.position.set(lx, baseY + 1.0, lz);
    g.add(lh);
  }

  return g;
}

function makeTown(rng) {
  const g = new THREE.Group();

  /* 长条形的岛基 */
  const base = new THREE.Mesh(rockGeo, M.rock);
  base.scale.set(40, 2.0, 18);
  base.position.y = -0.6;
  base.rotation.y = 0.1;
  addOutline(base, 0.012);
  g.add(base);

  const top = new THREE.Mesh(rockGeo, M.hill);
  top.scale.set(34, 1.5, 14);
  top.position.y = 0.25;
  g.add(top);

  /* 一排高脚屋，前后错落 */
  const houseN = 6 + ((rng() * 3) | 0);
  const walls = [M.wallA, M.wallB, M.wallC, M.blueWall];
  const roofs = [M.roofA, M.roofB, M.roofC];
  for (let i = 0; i < houseN; i++) {
    const w = rand(4.0, 6.0);
    const h = rand(3.2, 4.8);
    const d = rand(3.6, 5.2);
    const house = makeHouse(rng, w, h, d, walls[(rng() * walls.length) | 0], roofs[(rng() * roofs.length) | 0]);
    house.position.set(
      -27 + i * (54 / (houseN - 1)) + rand(-1.2, 1.2),
      1.35 + rand(0, 0.55),
      (i % 2 === 0 ? 2.5 : -2.0) + rand(-1.4, 1.4)
    );
    house.rotation.y = rand(-0.18, 0.18);
    g.add(house);
  }

  /* 后排房子，堆出城镇的厚度 */
  for (let i = 0; i < 3; i++) {
    const w = rand(3.6, 5.2);
    const h = rand(2.8, 3.8);
    const d = rand(3.2, 4.4);
    const house = makeHouse(rng, w, h, d, walls[(rng() * walls.length) | 0], roofs[(rng() * roofs.length) | 0]);
    house.position.set(-17 + i * 17 + rand(-2.0, 2.0), 1.9 + rand(0, 0.5), -6.4 + rand(-1.0, 1.0));
    house.rotation.y = rand(-0.25, 0.25);
    g.add(house);
  }

  /* 钟楼：城镇的剪影重心 */
  const tower = new THREE.Group();
  const towerBody = new THREE.Mesh(new THREE.BoxGeometry(5.4, 12, 5.4), M.wallB);
  towerBody.position.y = 6.0;
  addOutline(towerBody, 0.03);
  tower.add(towerBody);
  const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(4.5, 4.2, 4), M.roofB);
  towerRoof.position.y = 14.1;
  towerRoof.rotation.y = Math.PI / 4;
  addOutline(towerRoof, 0.03);
  tower.add(towerRoof);
  const clock = new THREE.Mesh(new THREE.CircleGeometry(1.25, 20), M.clock);
  clock.position.set(0, 9.2, 2.73);
  tower.add(clock);
  const clockRim = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.1, 6, 20), M.roofA);
  clockRim.position.set(0, 9.2, 2.74);
  tower.add(clockRim);
  const tg = groundAt(top, -7.5, -3.2, 5);
  tower.position.set(-7.5, (tg !== null ? tg : 1.3) - 0.1, -3.2);
  g.add(tower);

  /* 临街灯串 */
  const wire = new THREE.Mesh(new THREE.BoxGeometry(48, 0.03, 0.03), M.metal);
  wire.position.set(0, 3.5, 4.6);
  g.add(wire);
  for (let i = 0; i < 7; i++) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), M.lantern);
    lamp.position.set(-21 + i * 7, 3.28, 4.6);
    g.add(lamp);
  }

  /* 树 */
  for (let i = 0; i < 4; i++) {
    const tree = makeTree(rng, 4.5 + rng() * 3.5, 1.3 + rng() * 1.1);
    const tx = -25 + rng() * 50;
    const tz = -5.2 + rng() * 2.4;
    const gy = groundAt(top, tx, tz, 5);
    tree.position.set(tx, (gy !== null ? gy : 1.3) - 0.3, tz);
    g.add(tree);
  }

  /* 伸向海面的木栈桥 + 灯笼 */
  const pier = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.2, 20), M.wood);
  pier.position.set(6, 1.15, 14);
  addOutline(pier, 0.018);
  g.add(pier);

  for (const z of [6, 12, 18, 23]) {
    for (const x of [4.5, 7.5]) {
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 2.6, 6), M.woodDark);
      pile.position.set(x, 0.0, z);
      g.add(pile);
    }
  }

  for (const z of [9, 16, 22]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.4, 6), M.woodDark);
    pole.position.set(7.35, 2.2, z);
    g.add(pole);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), M.lantern);
    lamp.position.set(7.35, 3.45, z);
    g.add(lamp);
  }

  /* 小渔船 */
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.55, 3.6), M.wood);
  hull.position.y = 0.42;
  addOutline(hull, 0.03);
  boat.add(hull);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 1.0), M.wallB);
  cabin.position.set(0, 0.95, -0.4);
  addOutline(cabin, 0.02);
  boat.add(cabin);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.4, 6), M.woodDark);
  mast.position.set(0, 2.0, 0.7);
  boat.add(mast);
  boat.position.set(10.4, 0.1, 22);
  boat.rotation.y = 0.25;
  g.add(boat);

  /* 晾衣绳：生活气息 */
  g.add(makeLaundryLine(rng, -12, 4.8, 6.5));

  return g;
}

function makeAbandonedStation(rng) {
  const g = new THREE.Group();

  /* 下陷的站台 */
  const deck = new THREE.Mesh(new THREE.BoxGeometry(24, 0.45, 5.4), M.rustLight);
  deck.position.set(0, 1.05, 0);
  deck.rotation.z = 0.018;
  addOutline(deck, 0.028);
  g.add(deck);

  for (const x of [-10, -5, 5, 10]) {
    for (const z of [-1.9, 1.9]) {
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 2.2, 6), M.woodDark);
      pile.position.set(x, 0.0, z);
      g.add(pile);
    }
  }

  /* 破雨棚：一块倾斜，一块短了一截 */
  const roofA = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.12, 3.1), M.rust);
  roofA.position.set(-7.2, 4.35, -0.9);
  roofA.rotation.x = -0.26;
  roofA.rotation.z = 0.05;
  addOutline(roofA, 0.02);
  g.add(roofA);

  const roofB = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.12, 3.1), M.rust);
  roofB.position.set(7.8, 4.62, -1.1);
  roofB.rotation.x = 0.3;
  roofB.rotation.z = -0.11;
  addOutline(roofB, 0.02);
  g.add(roofB);

  /* 断成两截的檐板，中间露出一段缺口 */
  const fasciaA = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.32, 0.12), M.rust);
  fasciaA.position.set(-5.0, 4.28, 0.75);
  fasciaA.rotation.z = 0.03;
  addOutline(fasciaA, 0.016);
  g.add(fasciaA);
  const fasciaB = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.32, 0.12), M.rust);
  fasciaB.position.set(8.0, 4.4, 0.75);
  fasciaB.rotation.z = -0.08;
  addOutline(fasciaB, 0.016);
  g.add(fasciaB);

  /* 掉在站台上的横梁 */
  const fallen = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.16, 0.16), M.metal);
  fallen.position.set(3.4, 1.36, 1.9);
  fallen.rotation.y = 0.32;
  fallen.rotation.z = 0.06;
  addOutline(fallen, 0.012);
  g.add(fallen);

  /* 锈斑 */
  for (let i = 0; i < 5; i++) {
    const stain = new THREE.Mesh(new THREE.BoxGeometry(1.0 + rng() * 2.2, 0.02, 0.5 + rng() * 1.0), M.rust);
    stain.position.set(-9 + rng() * 18, 1.29, -2.0 + rng() * 3.6);
    g.add(stain);
  }

  /* 柱子，有的歪了 */
  const colX = [-10.5, -4.8, 4.2, 10.2];
  colX.forEach((x, i) => {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.4, 0.16), M.metal);
    col.position.set(x, 2.75, 1.3);
    col.rotation.z = (i === 1 ? 0.12 : (i === 3 ? -0.06 : 0.02));
    addOutline(col, 0.014);
    g.add(col);
  });

  /* 站牌 */
  const frame = new THREE.Mesh(new THREE.BoxGeometry(6.1, 1.55, 0.08), M.woodDark);
  frame.position.set(-2.0, 3.45, 1.42);
  addOutline(frame, 0.016);
  g.add(frame);

  const signMat = toon({
    map: getAbandonedSign(),
    emissive: 0xffffff,
    emissiveMap: getAbandonedSign(),
    emissiveIntensity: 0.3,
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.9, 1.36), signMat);
  sign.position.set(-2.0, 3.45, 1.47);
  g.add(sign);

  /* 长椅 */
  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.58), M.wood);
  seat.position.set(6.2, 1.78, 1.0);
  seat.rotation.z = -0.05;
  addOutline(seat, 0.012);
  g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.42, 0.09), M.wood);
  back.position.set(6.2, 2.05, 0.72);
  back.rotation.z = -0.08;
  addOutline(back, 0.012);
  g.add(back);

  /* 倒下的灯柱 */
  const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 5.2, 6), M.metal);
  lampPole.position.set(9.2, 2.9, 2.2);
  lampPole.rotation.z = 0.28;
  addOutline(lampPole, 0.012);
  g.add(lampPole);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), M.dimLamp);
  lamp.position.set(10.0, 5.35, 2.2);
  g.add(lamp);

  /* 断了半截的栏杆 */
  for (const x of [-10, -6, 2, 6]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.0, 0.05), M.metal);
    post.position.set(x, 1.8, 2.62);
    g.add(post);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(15, 0.05, 0.05), M.metal);
  rail.position.set(-2.0, 2.3, 2.62);
  rail.rotation.z = 0.012;
  g.add(rail);

  /* 爬在雨棚上的藤蔓 */
  for (let i = 0; i < 5; i++) {
    const vine = new THREE.Mesh(lowSphere, M.leafB);
    vine.scale.set(0.5 + rng() * 0.8, 0.3 + rng() * 0.4, 0.5 + rng() * 0.7);
    vine.position.set(-11 + rng() * 12, 4.5 + rng() * 0.4, -2.2 + rng() * 2.0);
    g.add(vine);
  }

  return g;
}

export function createScenerySystem(scene) {
  const items = [];
  let timer = 0;
  let nextGap = rand(7.0, 12.0);
  let counter = 0;

  /* 这些几何体被多个风景共用，不能跟着单个风景销毁 */
  const sharedGeo = new Set([rockGeo, lowSphere, trunkGeo]);

  function disposeItem(g) {
    const seen = new Set();
    g.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      const geo = o.geometry;
      if (sharedGeo.has(geo) || seen.has(geo)) return;
      seen.add(geo);
      geo.dispose();
    });
  }

  function removeAt(i) {
    const it = items[i];
    scene.remove(it.g);
    disposeItem(it.g);
    items.splice(i, 1);
  }

  function add(kind, x, z, rng = Math.random) {
    let g;
    if (kind === 'island') g = makeIsland(rng);
    else if (kind === 'town') g = makeTown(rng);
    else g = makeAbandonedStation(rng);
    g.position.set(x, 0, z);
    scene.add(g);
    items.push({ g, kind });
    counter++;
    return g;
  }

  function chooseKind() {
    const r = Math.random();
    if (r < 0.45) return 'island';
    if (r < 0.78) return 'town';
    return 'abandoned';
  }

  function spawnRandom() {
    const kind = chooseKind();
    let z;
    if (kind === 'island') z = rand(-100, -230);
    else if (kind === 'town') z = rand(-82, -132);
    else z = rand(-34, -52);
    add(kind, 330 + rand(0, 100), z);
  }

  /* 开场的三处风景，保证镜头拉开时右侧不空 */
  add('abandoned', 95, -46);
  add('island', 180, -120);
  add('town', 320, -108);

  function clear() {
    while (items.length) removeAt(0);
    timer = 0;
  }

  function update(dt) {
    timer += dt;
    if (timer > nextGap) {
      timer = 0;
      nextGap = rand(7.5, 12.5);
      spawnRandom();
    }

    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.g.position.x -= SPEED * dt;
      if (it.g.position.x < -900) {
        removeAt(i);
      }
    }

    /* 限制同屏数量，防止越积越多 */
    while (items.length > 10) {
      removeAt(0);
    }
  }

  return { update, add, spawnRandom, clear };
}
