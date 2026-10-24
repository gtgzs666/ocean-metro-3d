import * as THREE from 'three';
import { CAR_LEN, CAR_GAP, CAR_COUNT, SPEED, rand } from './palette.js';

/* ============================================================
   车轮溅起的水雾（CPU 粒子，量不大，但很出效果）
   ============================================================ */
export function createSpray(scene) {
  const COUNT = 1200;
  const pos = new Float32Array(COUNT * 3);
  const life = new Float32Array(COUNT);
  const maxLife = new Float32Array(COUNT);
  const vel = new Float32Array(COUNT * 3);

  const emitters = [];
  for (let c = 0; c < CAR_COUNT; c++) {
    const cx = (c - (CAR_COUNT - 1) / 2) * (CAR_LEN + CAR_GAP);
    for (const bx of [-5.25, 5.25]) {
      for (const ax of [-1.0, 1.0]) {
        for (const side of [-1, 1]) {
          emitters.push({ x: cx + bx + ax, z: side * 2.42, side });
        }
      }
    }
  }

  function respawn(i, prewarm = false) {
    const e = emitters[(Math.random() * emitters.length) | 0];
    pos[i * 3 + 0] = e.x + rand(-0.9, 0.9);
    pos[i * 3 + 1] = rand(0.08, 0.4);
    pos[i * 3 + 2] = e.z + rand(-0.1, 0.1);

    const lateral = e.side * rand(0.4, 3.0);
    vel[i * 3 + 0] = -SPEED * rand(0.25, 0.55) - rand(0, 4.0);
    vel[i * 3 + 1] = rand(1.2, 4.6);
    vel[i * 3 + 2] = lateral;

    const ml = rand(0.55, 1.35);
    maxLife[i] = ml;
    life[i] = prewarm ? Math.random() : 1.0;
  }

  for (let i = 0; i < COUNT; i++) respawn(i, true);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aLife', new THREE.BufferAttribute(life, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uScale: { value: 900 },
      uNight: { value: 0 },
    },
    vertexShader: /* glsl */`
      precision highp float;
      attribute float aLife;
      uniform float uScale;
      varying float vA;
      void main() {
        vA = aLife;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = (0.30 + 0.55 * (1.0 - aLife)) * uScale / max(-mv.z, 0.5);
        gl_Position = projectionMatrix * mv;
        if (aLife <= 0.001) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform float uNight;
      varying float vA;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.04, d) * vA * 0.6;
        vec3 col = mix(vec3(0.86, 0.93, 0.97), vec3(0.45, 0.58, 0.66), uNight * 0.7);
        gl_FragColor = vec4(col, a);
      }
    `,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 6;
  scene.add(points);

  function update(dt, night) {
    mat.uniforms.uNight.value = night;
    mat.uniforms.uScale.value =
      (window.innerHeight * Math.min(window.devicePixelRatio || 1, 2)) /
      (2 * Math.tan((42 * Math.PI / 180) / 2)) * 0.55;

    for (let i = 0; i < COUNT; i++) {
      if (life[i] <= 0) {
        respawn(i);
        continue;
      }
      const k = i * 3;
      life[i] -= dt / maxLife[i];

      vel[k + 1] -= 8.5 * dt;
      vel[k + 0] *= 1 - 0.7 * dt;
      vel[k + 2] *= 1 - 0.5 * dt;

      pos[k + 0] += vel[k + 0] * dt;
      pos[k + 1] += vel[k + 1] * dt;
      pos[k + 2] += vel[k + 2] * dt;

      if (pos[k + 1] < 0.02) {
        pos[k + 1] = 0.02;
        vel[k + 1] *= -0.15;
        vel[k + 2] *= 0.85;
      }
      if (life[i] < 0) life[i] = 0;
    }

    geo.attributes.position.needsUpdate = true;
    geo.attributes.aLife.needsUpdate = true;
  }

  return { points, update };
}
