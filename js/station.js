import * as THREE from 'three';
import { SPEED, rand } from './palette.js';
import { toon, glow, addOutline } from './toon.js';

const NAMES = [
  { n: '汐见', r: 'SHIOMI' },
  { n: '海原', r: 'UMIHARA' },
  { n: '雾滨', r: 'KIRIHAMA' },
  { n: '鸥町', r: 'KAMOMECHO' },
  { n: '潮骚', r: 'SHIOSAI' },
  { n: '灯塔前', r: 'TODAIMAE' },
  { n: '蜃气楼', r: 'SHINKIRO' },
  { n: '水平线', r: 'SUIHEISEN' },
];

function makeSignTexture(name, romaji) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const g = c.getContext('2d');

  g.fillStyle = '#0e2b2b';
  g.fillRect(0, 0, 1024, 256);

  g.strokeStyle = 'rgba(214, 226, 210, 0.55)';
  g.lineWidth = 5;
  g.beginPath();
  g.roundRect(20, 20, 984, 216, 8);
  g.stroke();

  g.fillStyle = '#eef3ea';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '600 112px "Noto Sans CJK SC", "Noto Sans SC", sans-serif';
  g.fillText(name + '站', 512, 112);

  g.fillStyle = 'rgba(224, 233, 224, 0.62)';
  g.font = '500 34px "Noto Sans CJK SC", sans-serif';
  g.fillText(romaji + ' STATION', 512, 190);

  g.fillStyle = '#4f8f83';
  g.fillRect(360, 222, 304, 5);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function createStationSystem(scene) {
  const stations = [];
  let timer = 0;
  let nextGap = rand(20.0, 40.0);
  let counter = 0;

  const matDeck = toon({ color: 0x3b4043 });
  const matConcrete = toon({ color: 0x6f726d });
  const matCanopy = toon({ color: 0x24403e, side: THREE.DoubleSide });
  const matColumn = toon({ color: 0x8e9089 });
  const matDark = toon({ color: 0x21282b });
  const matWood = toon({ color: 0x5a4130 });
  const matLamp = glow(0xffd9a1, 5.0);
  const matStrip = glow(0xffe2b4, 1.6);
  const matFigure = toon({ color: 0x141b20 });
  const matUmbrella = toon({ color: 0x5e2a2e, side: THREE.DoubleSide });
  const matMachine = toon({ color: 0xdfe4de });
  const matMachineGlow = glow(0xd8ecff, 1.4);

  const geoDeck = new THREE.BoxGeometry(58, 0.55, 8.4);
  const geoColumn = new THREE.CylinderGeometry(0.115, 0.115, 5.0, 10);
  const geoPillar = new THREE.CylinderGeometry(0.16, 0.16, 3.2, 10);
  const geoRoof = new THREE.BoxGeometry(58, 0.14, 4.4);
  const geoFascia = new THREE.BoxGeometry(58, 0.6, 0.16);
  const geoLampShade = new THREE.CylinderGeometry(0.18, 0.30, 0.16, 12);
  const geoBenchSeat = new THREE.BoxGeometry(3.4, 0.16, 0.66);
  const geoBenchBack = new THREE.BoxGeometry(3.4, 0.5, 0.1);
  const geoBenchLeg = new THREE.BoxGeometry(0.1, 0.55, 0.5);
  const geoCapsule = new THREE.CapsuleGeometry(0.26, 0.82, 5, 10);
  const geoHead = new THREE.SphereGeometry(0.17, 14, 10);
  const geoUmb = new THREE.ConeGeometry(0.82, 0.36, 14, 1, true);
  const geoUmbShaft = new THREE.CylinderGeometry(0.018, 0.018, 0.95, 6);

  function build(nameInfo) {
    const g = new THREE.Group();

    /* 站台 */
    const deck = new THREE.Mesh(geoDeck, matDeck);
    deck.position.set(0, 1.0, -7.0);
    deck.receiveShadow = true;
    addOutline(deck, 0.06);
    g.add(deck);

    const edge = new THREE.Mesh(new THREE.BoxGeometry(58, 0.05, 0.42), matConcrete);
    edge.position.set(0, 1.29, -2.95);
    g.add(edge);

    const tactile = new THREE.Mesh(new THREE.BoxGeometry(58, 0.045, 0.42),
      toon({ color: 0xa5852f }));
    tactile.position.set(0, 1.29, -3.62);
    g.add(tactile);

    /* 水下支柱 */
    for (const z of [-3.45, -10.55]) {
      for (let x = -27; x <= 27; x += 9) {
        const p = new THREE.Mesh(geoPillar, matDark);
        p.position.set(x, 0.1, z);
        g.add(p);
      }
    }

    /* 雨棚 */
    for (const [z, rot] of [[-4.9, -0.055], [-9.1, 0.055]]) {
      const roof = new THREE.Mesh(geoRoof, matCanopy);
      roof.position.set(0, 6.15, z);
      roof.rotation.x = rot;
      roof.castShadow = true;
      roof.receiveShadow = true;
      addOutline(roof, 0.045);
      g.add(roof);
    }

    const fascia = new THREE.Mesh(geoFascia, matCanopy);
    fascia.position.set(0, 6.12, -2.68);
    addOutline(fascia, 0.03);
    g.add(fascia);

    /* 柱子 */
    for (const z of [-3.05, -10.95]) {
      for (let x = -25.5; x <= 25.5; x += 8.5) {
        const col = new THREE.Mesh(geoColumn, matColumn);
        col.position.set(x, 3.72, z);
        col.castShadow = true;
        addOutline(col, 0.026);
        g.add(col);
      }
    }

    /* 吊灯 */
    for (let x = -24; x <= 24; x += 8) {
      const shade = new THREE.Mesh(geoLampShade, matDark);
      shade.position.set(x, 5.66, -6.0);
      g.add(shade);

      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), matLamp);
      lamp.position.set(x, 5.5, -6.0);
      g.add(lamp);

      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 4), matDark);
      wire.position.set(x, 5.9, -6.0);
      g.add(wire);
    }

    const light = new THREE.PointLight(0xffc98a, 30, 26, 2.0);
    light.position.set(0, 4.9, -6.6);
    g.add(light);

    /* 雨棚下的长灯带 */
    const strip = new THREE.Mesh(new THREE.BoxGeometry(54, 0.055, 0.12), matStrip);
    strip.position.set(0, 5.98, -6.05);
    g.add(strip);

    /* 站名牌 */
    const signTex = makeSignTexture(nameInfo.n, nameInfo.r);
    const signMat = toon({
      map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.55,
    });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(8.9, 2.42, 0.1), matDark);
    frame.position.set(0, 5.08, -2.6);
    addOutline(frame, 0.03);
    g.add(frame);

    const sign = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 2.12), signMat);
    sign.position.set(0, 5.08, -2.54);
    g.add(sign);

    /* 长椅 */
    for (const bx of [-15, 0, 15]) {
      const seat = new THREE.Mesh(geoBenchSeat, matWood);
      seat.position.set(bx, 1.88, -9.35);
      addOutline(seat, 0.018);
      g.add(seat);
      const back = new THREE.Mesh(geoBenchBack, matWood);
      back.position.set(bx, 2.18, -9.66);
      addOutline(back, 0.014);
      g.add(back);
      for (const lx of [-1.4, 1.4]) {
        const leg = new THREE.Mesh(geoBenchLeg, matDark);
        leg.position.set(bx + lx, 1.55, -9.4);
        g.add(leg);
      }
    }

    /* 自动售货机 */
    const vm = new THREE.Mesh(new THREE.BoxGeometry(1.25, 2.3, 0.92), matMachine);
    vm.position.set(20.5, 2.43, -10.4);
    vm.castShadow = true;
    addOutline(vm, 0.03);
    g.add(vm);
    const vmFront = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 1.65), matMachineGlow);
    vmFront.position.set(20.5, 2.55, -9.93);
    g.add(vmFront);

    /* 栏杆 */
    const rail = new THREE.Mesh(new THREE.BoxGeometry(58, 0.05, 0.05), matColumn);
    rail.position.set(0, 2.45, -11.1);
    g.add(rail);
    for (let x = -28; x <= 28; x += 3.5) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.15, 0.05), matColumn);
      post.position.set(x, 1.86, -11.1);
      g.add(post);
    }

    /* 等车的剪影 */
    for (const [px, pz, umb] of [[-6.5, -6.6, true], [11.5, -7.4, false]]) {
      const body = new THREE.Mesh(geoCapsule, matFigure);
      body.position.set(px, 2.05, pz);
      body.castShadow = true;
      addOutline(body, 0.014);
      g.add(body);
      const head = new THREE.Mesh(geoHead, matFigure);
      head.position.set(px, 2.78, pz);
      addOutline(head, 0.01);
      g.add(head);
      if (umb) {
        const cap = new THREE.Mesh(geoUmb, matUmbrella);
        cap.position.set(px, 3.28, pz);
        g.add(cap);
        const shaft = new THREE.Mesh(geoUmbShaft, matDark);
        shaft.position.set(px + 0.3, 2.85, pz);
        g.add(shaft);
      }
    }

    /* 站台两端的灯柱 */
    for (const px of [-27, 27]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 7.2, 8), matDark);
      pole.position.set(px, 4.0, -4.4);
      g.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), matLamp);
      lamp.position.set(px, 7.55, -4.4);
      g.add(lamp);
    }

    g.position.set(330, 0, 0);
    g.userData = {
      nameInfo,
      passed: false,
      nextAnnounced: false,
      nextInfo: null,
    };
    return g;
  }

  function spawn(startX = 330) {
    const info = NAMES[counter % NAMES.length];
    counter++;
    const nextInfo = NAMES[counter % NAMES.length];
    const g = build(info);
    g.userData.nextInfo = nextInfo;
    g.position.x = startX;
    scene.add(g);
    stations.push(g);
  }

  function update(dt, onEvent) {
    timer += dt;
    if (timer > nextGap) {
      timer = 0;
      nextGap = rand(20.0, 40.0);
      spawn();
    }

    for (let i = stations.length - 1; i >= 0; i--) {
      const s = stations[i];
      s.position.x -= SPEED * dt;
      const x = s.position.x;

      if (!s.userData.passed && x < 55) {
        s.userData.passed = true;
        onEvent && onEvent('pass', s.userData.nameInfo);
      }
      if (!s.userData.nextAnnounced && x < -25) {
        s.userData.nextAnnounced = true;
        onEvent && onEvent('next', s.userData.nextInfo);
      }

      if (x < -360) {
        scene.remove(s);
        s.traverse(o => {
          if (o.isMesh && o.material && o.material.map && o.material.map.isCanvasTexture) {
            o.material.map.dispose();
          }
        });
        stations.splice(i, 1);
      }
    }
  }

  return { update, spawn };
}
