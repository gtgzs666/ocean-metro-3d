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

/* 圆角矩形，用于风挡和车身截面 */
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
  let headlightBeams = null;
  let headlightBeamMat = null;
  const headlightWaterHits = [new THREE.Vector3(), new THREE.Vector3()];
  const _hitLocal = new THREE.Vector3();

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

      /* --- 夜间前灯：两道淡的扇形光束 ---
         多层扇形微微上仰，离开水面；水面倒影由平面反射相机生成，和车窗倒影同一套反射。 */
      const beamLen = 38;
      const beamWidth = 2.4;
      const beamGeo = new THREE.PlaneGeometry(beamLen, beamWidth, 1, 1);
      beamGeo.translate(beamLen / 2, 0, 0); // 灯口在 x=0，远端在 x=beamLen；竖直光面
      const beamGeoH = beamGeo.clone();
      beamGeoH.rotateX(-Math.PI / 2);       // 水平光面，保留第一版扇形并负责水面倒影

      headlightBeamMat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(0xffe2b8) },
          uIntensity: { value: 0.38 },
        },
        vertexShader: /* glsl */`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vec4 wp = modelMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `,
        fragmentShader: /* glsl */`
          precision highp float;
          uniform vec3 uColor;
          uniform float uTime;
          uniform float uIntensity;
          varying vec2 vUv;

          void main() {
            float along = vUv.x;
            float across = abs(vUv.y - 0.5) * 2.0;

            float nearFade = smoothstep(0.0, 0.05, along);
            float farFade = 1.0 - smoothstep(0.55, 1.0, along);

            /* 从灯口向外张开的扇形边缘 */
            float halfW = mix(0.12, 0.92, pow(along, 0.8));
            float edge = 1.0 - smoothstep(halfW * 0.35, halfW, across);
            float body = 0.52 + 0.48 * (0.5 + 0.5 * sin(along * 7.0 + across * 8.0 - uTime * 1.1));
            float grain = 0.86 + 0.14 * sin(along * 29.0 + across * 13.0 + uTime * 0.55);
            float core = exp(-pow((vUv.y - 0.5) / mix(0.018, 0.10, along), 2.0))
                       * (1.0 - smoothstep(0.45, 0.9, along)) * 0.03;

            float a = uIntensity * nearFade * farFade * (edge * body * grain + core);
            gl_FragColor = vec4(uColor, a);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide,
      });

      headlightBeams = new THREE.Group();
      headlightBeams.position.set(frontX + 0.04, 2.16, 0);
      headlightBeams.rotation.z = -0.16;  // 光束向下压，照到前方水面
      headlightBeams.visible = false;
      for (const z of [-1.1, 1.1]) {
        const vertical = new THREE.Mesh(beamGeo, headlightBeamMat);
        vertical.position.z = z;
        vertical.rotation.set(0, -Math.sign(z) * 0.035, 0.02);
        vertical.renderOrder = 3;
        vertical.frustumCulled = false;
        headlightBeams.add(vertical);

        const horizontal = new THREE.Mesh(beamGeoH, headlightBeamMat);
        horizontal.position.z = z;
        horizontal.rotation.set(0, -Math.sign(z) * 0.035, 0.02);
        horizontal.renderOrder = 3;
        horizontal.frustumCulled = false;
        headlightBeams.add(horizontal);
      }
      car.add(headlightBeams);

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
    if (headlightBeams) headlightBeams.visible = on;
  }

  function update(dt, elapsed, speed) {
    /* 车身轻微起伏 */
    group.position.y = Math.sin(elapsed * 1.35) * 0.045 + Math.sin(elapsed * 2.7) * 0.018;
    roll = Math.sin(elapsed * 0.9) * 0.0035;
    group.rotation.z = roll;

    for (const w of wheels) {
      w.rotation.z -= (speed / 0.55) * dt;
    }

    if (headlightBeams && headlightBeamMat) {
      headlightBeamMat.uniforms.uTime.value = elapsed;
      headlightBeams.updateWorldMatrix(true, false);
      const t = 2.16 / Math.sin(0.16); // 与光束下压角一致，求中心线落到水面的位置
      for (let i = 0; i < 2; i++) {
        _hitLocal.set(t, 0, i === 0 ? -1.1 : 1.1);
        headlightBeams.localToWorld(_hitLocal);
        headlightWaterHits[i].copy(_hitLocal);
      }
    }
  }

  return { group, wheels, windowMats, update, setHeadlights, headlightWaterHits };
}
