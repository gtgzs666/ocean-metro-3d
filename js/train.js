import * as THREE from 'three';
import { CAR_LEN, CAR_GAP, CAR_COUNT } from './palette.js';
import { toon, glow, addOutline } from './toon.js';

/* ============================================================
   车窗贴图：暖色车厢 + 剪影乘客，用 canvas 现场画
   ============================================================ */
function makeWindowTexture(renderer) {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 256;
  const g = c.getContext('2d');

  g.fillStyle = '#08131c';
  g.fillRect(0, 0, c.width, c.height);

  const wins = 6;
  const pad = 26;
  const gap = 32;
  const w = (c.width - pad * 2 - gap * (wins - 1)) / wins;
  const y = 34;
  const h = 188;

  for (let i = 0; i < wins; i++) {
    const x = pad + i * (w + gap);

    g.save();
    g.beginPath();
    g.roundRect(x, y, w, h, 26);
    g.clip();

    const grad = g.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0.0, '#ffedc4');
    grad.addColorStop(0.45, '#ffd08a');
    grad.addColorStop(1.0, '#c8834a');
    g.fillStyle = grad;
    g.fillRect(x, y, w, h);

    /* 天花板灯 */
    g.fillStyle = 'rgba(255,255,238,0.92)';
    for (let k = 0; k < 3; k++) {
      g.fillRect(x + w * 0.14 + k * w * 0.27, y + 9, w * 0.16, 5);
    }

    /* 座椅靠背 */
    g.fillStyle = 'rgba(112,58,38,0.5)';
    g.fillRect(x, y + h * 0.64, w, h * 0.15);

    /* 吊环 */
    g.strokeStyle = 'rgba(74,45,28,0.45)';
    g.lineWidth = 4;
    for (let k = 0; k < 5; k++) {
      const sx = x + w * (0.12 + k * 0.19);
      g.beginPath();
      g.moveTo(sx, y);
      g.lineTo(sx, y + 28);
      g.stroke();
    }

    /* 乘客剪影 */
    const n = 2 + (i % 2);
    for (let k = 0; k < n; k++) {
      const px = x + w * (0.22 + k * 0.3) + ((i * 17) % 22);
      const py = y + h * 0.62;
      g.fillStyle = 'rgba(46, 32, 30, 0.86)';
      g.beginPath();
      g.arc(px, py - h * 0.22, h * 0.075, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.roundRect(px - h * 0.105, py - h * 0.14, h * 0.21, h * 0.3, h * 0.07);
      g.fill();
    }

    g.restore();

    /* 窗框 */
    g.strokeStyle = '#26343c';
    g.lineWidth = 13;
    g.beginPath();
    g.roundRect(x, y, w, h, 26);
    g.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
}

/* 日系电车的正面目的地显示 */
function makeDestinationTexture(renderer) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const g = c.getContext('2d');

  g.fillStyle = '#06110b';
  g.fillRect(0, 0, c.width, c.height);

  g.fillStyle = '#a9ffc0';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '600 118px "Noto Sans CJK SC", "Noto Sans SC", sans-serif';
  g.fillText('各站停车', c.width / 2, 100);

  g.fillStyle = '#e6ffe9';
  g.font = '500 46px "Noto Sans CJK SC", "Noto Sans SC", sans-serif';
  g.fillText('水 平 线  ·  LOCAL', c.width / 2, 196);

  /* LED 扫描线 */
  g.fillStyle = 'rgba(0, 0, 0, 0.16)';
  for (let y = 0; y < c.height; y += 6) g.fillRect(0, y, c.width, 2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
}

function makePlateTexture(renderer) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const g = c.getContext('2d');

  g.fillStyle = '#f1eee2';
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#1b2326';
  g.lineWidth = 10;
  g.strokeRect(8, 8, c.width - 16, c.height - 16);

  g.fillStyle = '#1b2326';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '600 58px "Noto Sans CJK SC", "Noto Sans SC", sans-serif';
  g.fillText('クハ 1001', c.width / 2, 66);
  g.font = '500 30px "Noto Sans CJK SC", "Noto Sans SC", sans-serif';
  g.fillText('水平线', c.width / 2, 124);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
}

/* 前灯眩光：柔光核 + 一道很淡的横向拉丝 */
function makeHeadlightGlareTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);

  const radial = g.createRadialGradient(128, 128, 2, 128, 128, 128);
  radial.addColorStop(0.0, 'rgba(255,255,248,1)');
  radial.addColorStop(0.08, 'rgba(255,250,224,0.98)');
  radial.addColorStop(0.22, 'rgba(255,232,176,0.46)');
  radial.addColorStop(0.55, 'rgba(255,208,136,0.12)');
  radial.addColorStop(1.0, 'rgba(255,194,116,0)');
  g.fillStyle = radial;
  g.fillRect(0, 0, 256, 256);

  g.globalCompositeOperation = 'lighter';
  const streak = g.createLinearGradient(0, 128, 256, 128);
  streak.addColorStop(0.0, 'rgba(255,230,180,0)');
  streak.addColorStop(0.35, 'rgba(255,244,210,0.3)');
  streak.addColorStop(0.5, 'rgba(255,252,236,0.8)');
  streak.addColorStop(0.65, 'rgba(255,244,210,0.3)');
  streak.addColorStop(1.0, 'rgba(255,230,180,0)');
  g.fillStyle = streak;
  g.fillRect(0, 126, 256, 4);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* 水面灯光倒影：上亮下暗的模糊拉长光斑，带横向波纹缺口 */
function makeHeadlightReflectionTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 256);

  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, 'rgba(255,246,220,0.95)');
  grad.addColorStop(0.18, 'rgba(255,232,188,0.6)');
  grad.addColorStop(0.5, 'rgba(255,216,164,0.22)');
  grad.addColorStop(0.8, 'rgba(255,202,142,0.06)');
  grad.addColorStop(1.0, 'rgba(255,196,132,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 256);

  g.globalCompositeOperation = 'destination-out';
  for (let y = 10; y < 256; y += 22) {
    g.fillStyle = 'rgba(0,0,0,0.24)';
    g.fillRect(0, y, 128, 3);
  }

  g.globalCompositeOperation = 'destination-in';
  const side = g.createLinearGradient(0, 0, 128, 0);
  side.addColorStop(0.0, 'rgba(0,0,0,0)');
  side.addColorStop(0.32, 'rgba(255,255,255,0.8)');
  side.addColorStop(0.5, 'rgba(255,255,255,1)');
  side.addColorStop(0.68, 'rgba(255,255,255,0.8)');
  side.addColorStop(1.0, 'rgba(0,0,0,0)');
  g.fillStyle = side;
  g.fillRect(0, 0, 128, 256);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* 驾驶舱内饰：暖色顶灯、仪表台、司机剪影，和其他车厢的窗光呼应 */
function makeCabInteriorTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 256);

  g.fillStyle = '#22170f';
  g.fillRect(0, 0, 512, 256);

  const glow = g.createRadialGradient(256, 118, 8, 256, 118, 245);
  glow.addColorStop(0.0, 'rgba(255,222,170,0.9)');
  glow.addColorStop(0.35, 'rgba(198,137,76,0.45)');
  glow.addColorStop(0.75, 'rgba(80,48,26,0.16)');
  glow.addColorStop(1.0, 'rgba(20,13,8,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, 512, 256);

  /* 顶部灯带 */
  g.fillStyle = 'rgba(255,238,196,0.95)';
  g.fillRect(92, 17, 328, 8);
  g.fillStyle = 'rgba(255,214,150,0.24)';
  g.fillRect(84, 25, 344, 5);

  /* 侧立柱 */
  g.fillStyle = '#0b0806';
  g.fillRect(0, 0, 30, 256);
  g.fillRect(482, 0, 30, 256);

  /* 仪表台 */
  g.fillStyle = '#090807';
  g.beginPath();
  g.moveTo(0, 198);
  g.quadraticCurveTo(256, 154, 512, 198);
  g.lineTo(512, 256);
  g.lineTo(0, 256);
  g.closePath();
  g.fill();

  /* 仪表台反光 */
  g.strokeStyle = 'rgba(255,188,116,0.24)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(42, 210);
  g.quadraticCurveTo(256, 172, 470, 210);
  g.stroke();

  /* 司机剪影 */
  g.fillStyle = '#0a0908';
  g.beginPath();
  g.ellipse(166, 127, 25, 30, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(122, 205);
  g.quadraticCurveTo(126, 155, 166, 153);
  g.quadraticCurveTo(208, 155, 216, 205);
  g.closePath();
  g.fill();

  /* 右侧副驾驶座/控制台剪影 */
  g.fillStyle = 'rgba(8,7,6,0.9)';
  g.beginPath();
  g.ellipse(372, 142, 22, 27, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(334, 204);
  g.quadraticCurveTo(340, 165, 372, 164);
  g.quadraticCurveTo(406, 165, 412, 204);
  g.closePath();
  g.fill();

  /* 几粒控制灯 */
  g.fillStyle = 'rgba(255,196,104,0.85)';
  g.fillRect(286, 195, 12, 3);
  g.fillRect(304, 195, 7, 3);
  g.fillStyle = 'rgba(130,208,190,0.75)';
  g.fillRect(318, 195, 5, 3);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/* 圆角方形截面的长条：横截面为圆角矩形，沿车长方向拉伸 */
function roundedPrism(w, h, r, len) {
  const shape = roundedRectShape(w, h, r);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: len,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 10,
  });
  geo.translate(0, 0, -len / 2);
  geo.rotateY(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/* ============================================================
   一节车厢
   ============================================================ */
export function createTrain(renderer) {
  const group = new THREE.Group();
  const wheels = [];
  const windowMats = [];

  /* 二渲三：平涂色 + 4 阶明暗，材质本身不再吃环境反射 */
  const matBody = toon({ color: 0xe8dfc8 });
  const matRoof = toon({ color: 0x9aa3a0 });
  const matDark = toon({ color: 0x222b30 });
  const matMetal = toon({ color: 0xa8b2b4 });
  const matTeal = toon({ color: 0x2a6b62 });
  const matRoofShell = toon({ color: 0x2f7064, side: THREE.DoubleSide });
  const matGlass = new THREE.MeshBasicMaterial({
    color: 0x16303a, transparent: true, opacity: 0.34, side: THREE.DoubleSide,
  });
  const matLamp = glow(0xfff0c8, 5.0);
  const matTail = glow(0xff3a26, 3.5);

  const lampOnColor = matLamp.color.clone();
  const lampOffColor = new THREE.Color(0x1b2428);
  let headlightsOn = null;
  let headLight = null;
  let headlightGlows = null;
  let headlightGlareMat = null;
  let headlightReflectionMat = null;

  /* 车头细节 */
  const destTex = makeDestinationTexture(renderer);
  const plateTex = makePlateTexture(renderer);
  const matCabGlass = new THREE.MeshBasicMaterial({ color: 0x06131a });
  const matCabGlassSide = new THREE.MeshBasicMaterial({ color: 0x081820 });
  const matBlackPanel = toon({ color: 0x0e171b });
  const matDest = new THREE.MeshBasicMaterial({ map: destTex });
  matDest.color.setRGB(2.1, 2.1, 2.1);
  const matPlate = new THREE.MeshBasicMaterial({ map: plateTex });
  const matTailDim = glow(0x6d1a12, 0.9);
  const matGlowStrip = new THREE.MeshBasicMaterial({
    color: 0x9fb8c2, transparent: true, opacity: 0.22,
  });

  const windowTex = makeWindowTexture(renderer);

  const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.2, 24);
  wheelGeo.rotateX(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.27, 0.27, 0.22, 20);
  hubGeo.rotateX(Math.PI / 2);
  const sphereGeo = new THREE.SphereGeometry(1, 40, 26);

  /* 统一截面：圆角正方形车身 */
  const BODY_W = 3.8;
  const BODY_H = 3.8;
  const BODY_R = 0.55;
  const BODY_Y = 2.6;

  function addPantograph(car, x) {
    const p = new THREE.Group();

    const base = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 1.15), matDark);
    base.position.y = 4.75;
    addOutline(base, 0.015);
    p.add(base);

    for (const z of [-0.38, 0.38]) {
      const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.22, 8), matMetal);
      ins.position.set(0, 4.9, z);
      p.add(ins);
    }

    const lower = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.3, 0.09), matMetal);
    lower.position.set(0.3, 5.55, 0);
    lower.rotation.z = -0.36;
    addOutline(lower, 0.01);
    p.add(lower);

    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.15, 0.08), matMetal);
    upper.position.set(0.45, 6.45, 0);
    upper.rotation.z = 0.34;
    p.add(upper);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 1.85), matDark);
    head.position.set(0.58, 6.96, 0);
    p.add(head);

    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 1.95), matMetal);
    strip.position.set(0.58, 6.995, 0);
    p.add(strip);

    p.position.x = x;
    car.add(p);
  }

  function buildCar(index) {
    const car = new THREE.Group();
    const isFront = index === CAR_COUNT - 1;
    const isRear = index === 0;

    /* --- 主车厢：圆角正方形截面 --- */
    const bodyGeo = roundedPrism(BODY_W, BODY_H, BODY_R, CAR_LEN);
    const body = new THREE.Mesh(bodyGeo, matBody);
    body.position.y = BODY_Y;
    body.castShadow = true;
    body.receiveShadow = true;
    addOutline(body, 0.075);
    car.add(body);

    /* 绿色平顶盖 */
    const roofGeo = roundedPrism(3.2, 0.2, 0.12, CAR_LEN - 0.5);
    const roofCap = new THREE.Mesh(roofGeo, matRoofShell);
    roofCap.position.set(0, BODY_Y + BODY_H / 2 + 0.08, 0);
    roofCap.castShadow = true;
    addOutline(roofCap, 0.035);
    car.add(roofCap);

    /* --- 底架 --- */
    const frame = new THREE.Mesh(new THREE.BoxGeometry(CAR_LEN - 1.2, 0.72, 3.84), matDark);
    frame.position.y = 1.16;
    frame.castShadow = true;
    addOutline(frame, 0.05);
    car.add(frame);

    const skirt = new THREE.Mesh(new THREE.BoxGeometry(CAR_LEN - 2.6, 0.32, 4.0), matDark);
    skirt.position.y = 0.86;
    addOutline(skirt, 0.035);
    car.add(skirt);

    /* --- 裙子下方设备箱 --- */
    for (const dx of [-4.6, -1.2, 2.0, 5.2]) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 1.5), matDark);
      box.position.set(dx, 0.86, dx > 0 ? 1.05 : -1.05);
      car.add(box);
    }

    /* --- 车窗带 + 外侧玻璃 --- */
    const winW = CAR_LEN - 3.6;
    const winGeo = new THREE.PlaneGeometry(winW, 0.95);

    for (const side of [1, -1]) {
      const winMat = toon({
        map: windowTex,
        emissive: 0xffffff,
        emissiveMap: windowTex,
        emissiveIntensity: 1.05,
      });
      windowMats.push(winMat);

      const band = new THREE.Mesh(winGeo, winMat);
      band.position.set(0, 2.9, side * 1.905);
      if (side < 0) band.rotation.y = Math.PI;
      car.add(band);

      const glass = new THREE.Mesh(new THREE.PlaneGeometry(winW + 0.1, 1.06), matGlass);
      glass.position.set(0, 2.9, side * 1.915);
      if (side < 0) glass.rotation.y = Math.PI;
      car.add(glass);

      /* --- 车门 --- */
      for (const dx of [-5.9, 0, 5.9]) {
        const door = new THREE.Mesh(new THREE.BoxGeometry(1.12, 2.0, 0.06), matTeal);
        door.position.set(dx, 2.2, side * 1.915);
        addOutline(door, 0.028);
        car.add(door);

        const dwin = new THREE.Mesh(
          new THREE.PlaneGeometry(0.62, 0.68),
          glow(0xffc276, 2.0)
        );
        dwin.position.set(dx, 2.82, side * 1.948);
        if (side < 0) dwin.rotation.y = Math.PI;
        car.add(dwin);

        const seam = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.95, 0.02), matDark);
        seam.position.set(dx, 2.2, side * 1.947);
        car.add(seam);
      }

      /* --- 腰线 --- */
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(CAR_LEN - 2.2, 0.18, 0.06), matTeal);
      stripe.position.set(0, 1.82, side * 1.906);
      car.add(stripe);
    }

    /* --- 车顶设备 --- */
    for (const dx of [-4.4, 4.4]) {
      const ac = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.34, 1.7), matRoof);
      ac.position.set(dx, 4.84, 0);
      ac.castShadow = true;
      addOutline(ac, 0.03);
      car.add(ac);
    }
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(CAR_LEN - 3.2, 0.12, 0.5), matRoof);
    ridge.position.y = 4.76;
    car.add(ridge);

    /* 每节车厢前后各一组受电弓 */
    const pantoXs = isFront ? [9.2, -7.4] : [7.4, -7.4];
    for (const px of pantoXs) addPantograph(car, px);

    /* --- 转向架与轮子 --- */
    for (const bx of [-5.25, 5.25]) {
      const bogie = new THREE.Group();
      bogie.position.x = bx;

      const bogieFrame = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.5, 2.2), matDark);
      bogieFrame.position.y = 0.95;
      bogieFrame.castShadow = true;
      addOutline(bogieFrame, 0.03);
      bogie.add(bogieFrame);

      for (const ax of [-1.0, 1.0]) {
        for (const side of [-1, 1]) {
          const w = new THREE.Mesh(wheelGeo, matDark);
          w.position.set(bx + ax, 0.55, side * 1.12);
          w.castShadow = true;
          car.add(w);
          wheels.push(w);

          const hub = new THREE.Mesh(hubGeo, matMetal);
          hub.position.set(bx + ax, 0.55, side * 1.135);
          car.add(hub);

          const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.3), matDark);
          box.position.set(bx + ax, 0.7, side * 1.0);
          car.add(box);
        }
      }
      car.add(bogie);
    }

    /* --- 车尾：圆角方形尾端（构图里不会出现） --- */
    if (isRear) {
      const rearPanel = new THREE.Mesh(
        new THREE.ShapeGeometry(roundedRectShape(2.4, 2.6, 0.35), 10),
        matDark
      );
      rearPanel.rotation.y = -Math.PI / 2;
      rearPanel.position.set(-CAR_LEN / 2 - 0.01, 2.6, 0);
      car.add(rearPanel);

      for (const z of [-1.0, 1.0]) {
        const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), matTail);
        lamp.rotation.y = -Math.PI / 2;
        lamp.position.set(-CAR_LEN / 2 - 0.02, 2.2, z);
        car.add(lamp);
      }

      const chin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 3.4), matDark);
      chin.position.set(-(CAR_LEN / 2 + 0.6), 0.9, 0);
      addOutline(chin, 0.03);
      car.add(chin);
    }

    /* --- 车头：圆角方形驾驶室 --- */
    if (isFront) {
      const frontX = CAR_LEN / 2 + 1.05;
      const cabCenter = CAR_LEN / 2 - 0.3;

      const cab = new THREE.Mesh(roundedPrism(BODY_W, BODY_H, BODY_R, 2.7), matBody);
      cab.position.set(cabCenter, BODY_Y, 0);
      cab.castShadow = true;
      cab.receiveShadow = true;
      addOutline(cab, 0.06);
      car.add(cab);

      /* 绿色车顶盖 + 小空调 */
      const cabRoof = new THREE.Mesh(roundedPrism(3.2, 0.2, 0.12, 2.6), matRoofShell);
      cabRoof.position.set(cabCenter, BODY_Y + BODY_H / 2 + 0.08, 0);
      cabRoof.castShadow = true;
      addOutline(cabRoof, 0.03);
      car.add(cabRoof);

      const cabAC = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.24, 1.35), matRoof);
      cabAC.position.set(cabCenter - 1.0, 4.84, -0.5);
      addOutline(cabAC, 0.02);
      car.add(cabAC);

      /* 黑色风挡 + 圆角外框 */
      const wsSurround = new THREE.Mesh(
        new THREE.ShapeGeometry(roundedRectShape(3.25, 1.15, 0.2), 10),
        matBlackPanel
      );
      wsSurround.rotation.y = Math.PI / 2;
      wsSurround.position.set(frontX + 0.012, 3.05, 0);
      car.add(wsSurround);

      const windshield = new THREE.Mesh(
        new THREE.ShapeGeometry(roundedRectShape(3.0, 0.92, 0.16), 10),
        matCabGlass
      );
      windshield.rotation.y = Math.PI / 2;
      windshield.position.set(frontX + 0.02, 3.07, 0);
      car.add(windshield);

      /* 驾驶舱暖光：前风挡内侧的灯带、仪表台和司机剪影 */
      const cabInteriorTex = makeCabInteriorTexture();
      const matCabInterior = toon({
        map: cabInteriorTex,
        emissive: 0xffffff,
        emissiveMap: cabInteriorTex,
        emissiveIntensity: 1.05,
      });
      windowMats.push(matCabInterior);

      const cabInterior = new THREE.Mesh(new THREE.PlaneGeometry(2.82, 0.76), matCabInterior);
      cabInterior.rotation.y = Math.PI / 2;
      cabInterior.position.set(frontX + 0.032, 3.07, 0);
      car.add(cabInterior);

      const cabLight = new THREE.PointLight(0xffd0a0, 0.9, 9, 2.0);
      cabLight.position.set(8.3, 3.05, 0);
      car.add(cabLight);

      const glassGlint = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.1, 2.35), matGlowStrip);
      glassGlint.position.set(frontX + 0.03, 3.25, 0.16);
      glassGlint.rotation.x = 0.15;
      car.add(glassGlint);

      /* 目的地显示 */
      const destBox = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.44, 1.72), matBlackPanel);
      destBox.position.set(frontX + 0.012, 3.8, 0);
      car.add(destBox);
      const dest = new THREE.Mesh(new THREE.PlaneGeometry(1.56, 0.3), matDest);
      dest.rotation.y = Math.PI / 2;
      dest.position.set(frontX + 0.06, 3.8, 0);
      car.add(dest);

      /* 下部黑色面板 + 头灯 / 尾灯 */
      const lampPanel = new THREE.Mesh(new THREE.PlaneGeometry(3.25, 0.55), matBlackPanel);
      lampPanel.rotation.y = Math.PI / 2;
      lampPanel.position.set(frontX + 0.014, 2.16, 0);
      car.add(lampPanel);

      for (const z of [-1.1, 1.1]) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.13, 0.185, 20), matBlackPanel);
        ring.rotation.y = Math.PI / 2;
        ring.position.set(frontX + 0.02, 2.16, z);
        car.add(ring);

        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.125, 20), matLamp);
        lens.rotation.y = Math.PI / 2;
        lens.position.set(frontX + 0.026, 2.16, z);
        car.add(lens);
      }

      /* --- 夜间前灯：两团眩光 + 水面两道模糊倒影 --- */
      const glareTex = makeHeadlightGlareTexture();
      const reflectionTex = makeHeadlightReflectionTexture();

      headlightGlareMat = new THREE.SpriteMaterial({
        map: glareTex,
        color: 0xfff2d8,
        transparent: true,
        opacity: 0.66,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
      });

      headlightReflectionMat = new THREE.MeshBasicMaterial({
        map: reflectionTex,
        color: 0xffe2b8,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
      });

      const reflectionGeo = new THREE.PlaneGeometry(2.2, 4.4);
      reflectionGeo.rotateX(-Math.PI / 2);

      headlightGlows = new THREE.Group();
      headlightGlows.visible = false;
      for (const z of [-1.1, 1.1]) {
        const glare = new THREE.Sprite(headlightGlareMat);
        glare.position.set(frontX + 0.18, 2.16, z);
        glare.scale.set(2.0, 1.35, 1);
        glare.renderOrder = 6;
        headlightGlows.add(glare);

        const reflection = new THREE.Mesh(reflectionGeo, headlightReflectionMat);
        reflection.position.set(frontX + 1.2, 0.07, z * 1.15);
        reflection.renderOrder = 4;
        headlightGlows.add(reflection);
      }
      car.add(headlightGlows);

      for (const z of [-0.78, 0.78]) {
        const tail = new THREE.Mesh(new THREE.CircleGeometry(0.05, 16), matTailDim);
        tail.rotation.y = Math.PI / 2;
        tail.position.set(frontX + 0.027, 2.16, z);
        car.add(tail);
      }

      /* 雨刷 */
      for (const z of [-0.48, 0.48]) {
        const wiper = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.4, 0.035), matBlackPanel);
        wiper.position.set(frontX + 0.035, 2.67, z);
        wiper.rotation.x = z > 0 ? 0.32 : -0.24;
        car.add(wiper);
      }

      /* 绿色前腰带 + 车号牌 */
      const frontStripe = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 3.45), matTeal);
      frontStripe.position.set(frontX + 0.02, 1.73, 0);
      car.add(frontStripe);

      const plateFrame = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.36), matBlackPanel);
      plateFrame.rotation.y = Math.PI / 2;
      plateFrame.position.set(frontX + 0.022, 1.38, 0);
      car.add(plateFrame);
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.28), matPlate);
      plate.rotation.y = Math.PI / 2;
      plate.position.set(frontX + 0.028, 1.38, 0);
      car.add(plate);

      /* 排障器 / 裙板 / 车钩 */
      const frontSkirt = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.55, 3.6), matDark);
      frontSkirt.position.set(9.0, 0.88, 0);
      addOutline(frontSkirt, 0.03);
      car.add(frontSkirt);

      const couplerBox = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.5), matDark);
      couplerBox.position.set(frontX + 0.24, 1.0, 0);
      addOutline(couplerBox, 0.02);
      car.add(couplerBox);

      const coupler = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.42, 12), matMetal);
      coupler.rotation.z = Math.PI / 2;
      coupler.position.set(frontX + 0.55, 1.0, 0);
      car.add(coupler);

      /* 侧面驾驶室窗 + 小目的地牌 + 腰带 */
      for (const side of [-1, 1]) {
        const zf = side * 1.905;
        const winFrame = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 1.1), matBlackPanel);
        winFrame.position.set(8.55, 3.05, zf);
        if (side < 0) winFrame.rotation.y = Math.PI;
        car.add(winFrame);

        const sideGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.9), matCabGlassSide);
        sideGlass.position.set(8.55, 3.05, zf + side * 0.004);
        if (side < 0) sideGlass.rotation.y = Math.PI;
        car.add(sideGlass);

        const sideGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 0.7), matCabInterior);
        sideGlow.position.set(8.55, 3.05, zf + side * 0.007);
        if (side < 0) sideGlow.rotation.y = Math.PI;
        car.add(sideGlow);

        const divider = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 0.025), matBody);
        divider.position.set(8.9, 3.05, zf + side * 0.008);
        car.add(divider);

        const sideDestBox = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.24), matBlackPanel);
        sideDestBox.position.set(8.55, 3.72, zf + side * 0.002);
        if (side < 0) sideDestBox.rotation.y = Math.PI;
        car.add(sideDestBox);

        const sideDest = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.16), matDest);
        sideDest.position.set(8.55, 3.72, zf + side * 0.009);
        if (side < 0) sideDest.rotation.y = Math.PI;
        car.add(sideDest);

        const sideStripe = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.14, 0.04), matTeal);
        sideStripe.position.set(8.8, 1.82, zf + side * 0.01);
        car.add(sideStripe);
      }

      const head = new THREE.PointLight(0xffe6bd, 9, 26, 2.0);
      head.position.set(CAR_LEN / 2 + 2.4, 2.0, 0);
      car.add(head);
      headLight = head;
    }

    /* --- 车端贯通道 --- */
    if (!isFront) {
      const gang = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.7, 2.5), matDark);
      gang.position.set(CAR_LEN / 2 + 0.58, 2.4, 0);
      addOutline(gang, 0.025);
      car.add(gang);
    }

    return car;
  }

  for (let i = 0; i < CAR_COUNT; i++) {
    const car = buildCar(i);
    car.position.x = (i - (CAR_COUNT - 1) / 2) * (CAR_LEN + CAR_GAP);
    group.add(car);
  }

  let roll = 0;

  function setHeadlights(on) {
    on = !!on;
    if (on === headlightsOn) return;
    headlightsOn = on;

    matLamp.color.copy(on ? lampOnColor : lampOffColor);
    if (headLight) headLight.intensity = on ? 9 : 0;
    if (headlightGlows) headlightGlows.visible = on;
  }

  function update(dt, elapsed, speed) {
    /* 车身轻微起伏 */
    group.position.y = Math.sin(elapsed * 1.35) * 0.045 + Math.sin(elapsed * 2.7) * 0.018;
    roll = Math.sin(elapsed * 0.9) * 0.0035;
    group.rotation.z = roll;

    for (const w of wheels) {
      w.rotation.z -= (speed / 0.55) * dt;
    }

    if (headlightGlareMat) {
      headlightGlareMat.opacity = 0.68 + 0.08 * Math.sin(elapsed * 2.1);
    }
    if (headlightReflectionMat) {
      headlightReflectionMat.opacity = 0.26 + 0.04 * Math.sin(elapsed * 1.4 + 1.7);
    }
  }

  return { group, wheels, windowMats, update, setHeadlights };
}
