import * as THREE from 'three';

/* 新加坡实时天气：Open-Meteo current 数据，10 分钟刷新一次 */
const API = 'https://api.open-meteo.com/v1/forecast'
  + '?latitude=1.3521&longitude=103.8198'
  + '&current=temperature_2m,weather_code,cloud_cover,rain,showers,precipitation,visibility,wind_speed_10m,is_day'
  + '&timezone=Asia%2FSingapore';

const RAIN_COUNT = 1800;
const RAIN_AREA = 46;
const RAIN_HEIGHT = 48;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function decodeWeather(code, cloud, rain, showers, precip, visibility) {
  let type = 'cloudy';
  let label = '多云';

  if (code === 0) { type = 'clear'; label = '晴天'; }
  else if (code <= 2) { type = 'cloudy'; label = '多云'; }
  else if (code === 3) { type = 'overcast'; label = '阴天'; }
  else if (code === 45 || code === 48) { type = 'haze'; label = '雾霾'; }
  else if (code >= 51 && code <= 57) { type = 'rain'; label = '毛毛雨'; }
  else if (code >= 61 && code <= 67) { type = 'rain'; label = code >= 65 ? '大雨' : code >= 63 ? '中雨' : '小雨'; }
  else if (code >= 71 && code <= 77) { type = 'overcast'; label = '阴天'; }
  else if (code >= 80 && code <= 82) { type = 'rain'; label = code === 80 ? '阵雨' : code === 81 ? '中阵雨' : '大阵雨'; }
  else if (code >= 85 && code <= 86) { type = 'rain'; label = '阵雨'; }
  else if (code >= 95) { type = 'storm'; label = '雷雨'; }
  else { type = 'cloudy'; label = '多云'; }

  let intensity = 0;
  if (type === 'rain' || type === 'storm') {
    const byCode =
      code === 51 ? 0.12 : code === 53 ? 0.2 : code === 55 ? 0.32 :
      code === 61 ? 0.36 : code === 63 ? 0.56 : code === 65 ? 0.82 :
      code === 80 ? 0.42 : code === 81 ? 0.65 : code === 82 ? 0.9 :
      code >= 95 ? 0.95 : 0.4;
    intensity = clamp(Math.max(byCode, (precip || 0) / 8, ((rain || 0) + (showers || 0)) / 8), 0.08, 1);
  }

  const cloudN = clamp((cloud || 0) / 100, 0, 1);
  const vis = clamp(visibility || 10000, 250, 30000);
  const overcast = type === 'overcast' ? 1 : (type === 'rain' || type === 'storm') ? 0.75 : type === 'haze' ? 0.65 : 0;
  const haze = clamp((1 - vis / 9000) + (type === 'haze' ? 0.35 : 0), 0, 1);
  const storm = type === 'storm';

  return {
    type, label, intensity, overcast, haze, storm,
    visibility: vis,
    cloud: Math.max(cloudN, overcast * 0.8),
  };
}

function makeRainTexture() {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 16, 64);
  const grd = g.createLinearGradient(0, 0, 0, 64);
  grd.addColorStop(0.0, 'rgba(255,255,255,0)');
  grd.addColorStop(0.16, 'rgba(220,240,255,0.55)');
  grd.addColorStop(0.55, 'rgba(220,240,255,0.95)');
  grd.addColorStop(0.9, 'rgba(220,240,255,0.35)');
  grd.addColorStop(1.0, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(6, 0, 4, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createWeather(scene, camera) {
  const state = {
    type: 'cloudy',
    label: '多云',
    code: 2,
    temp: null,
    cloud: 0.55,
    overcast: 0,
    rain: 0,
    precipitation: 0,
    visibility: 10000,
    wind: 0,
    intensity: 0,
    haze: 0,
    storm: false,
    flash: 0,
    source: 'fallback',
    updatedAt: 0,
    loaded: false,
    error: '',
  };

  let flash = 0;
  let boltLife = 0;
  let nextStrike = 0;
  let forcedStormUntil = 0;
  let soundEnabled = true;

  let audioCtx = null;
  let noiseBuffer = null;
  let rainGain = null;
  let rainFilter = null;

  /* ---------- 雨点 ---------- */
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(RAIN_COUNT * 3);
  const rainVel = new Float32Array(RAIN_COUNT);
  for (let i = 0; i < RAIN_COUNT; i++) {
    rainPos[i * 3] = (Math.random() * 2 - 1) * RAIN_AREA;
    rainPos[i * 3 + 1] = Math.random() * RAIN_HEIGHT;
    rainPos[i * 3 + 2] = (Math.random() * 2 - 1) * RAIN_AREA;
    rainVel[i] = 26 + Math.random() * 22;
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  rainGeo.setDrawRange(0, 0);

  const rainMat = new THREE.PointsMaterial({
    map: makeRainTexture(),
    color: 0xb9d0df,
    size: 1.0,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    alphaTest: 0.015,
    sizeAttenuation: true,
  });
  const rain = new THREE.Points(rainGeo, rainMat);
  rain.frustumCulled = false;
  rain.visible = false;
  rain.renderOrder = 3;
  scene.add(rain);

  /* ---------- 闪电 ---------- */
  const lightning = new THREE.DirectionalLight(0xdceaff, 0);
  lightning.position.set(-120, 180, -100);
  scene.add(lightning);
  scene.add(lightning.target);

  const boltPositions = new Float32Array(18 * 3);
  const boltGeo = new THREE.BufferGeometry();
  boltGeo.setAttribute('position', new THREE.BufferAttribute(boltPositions, 3));
  const boltMat = new THREE.LineBasicMaterial({
    color: 0xdcefff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  const bolt = new THREE.Line(boltGeo, boltMat);
  bolt.visible = false;
  bolt.frustumCulled = false;
  bolt.renderOrder = 9;
  scene.add(bolt);

  /* ---------- 声音：程序化雨声 + 雷声 ---------- */
  function initAudio() {
    if (audioCtx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      audioCtx = new Ctx();
      const len = Math.floor(audioCtx.sampleRate * 2.0);
      noiseBuffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

      const src = audioCtx.createBufferSource();
      src.buffer = noiseBuffer;
      src.loop = true;

      rainFilter = audioCtx.createBiquadFilter();
      rainFilter.type = 'lowpass';
      rainFilter.frequency.value = 3200;
      rainFilter.Q.value = 0.45;

      const hp = audioCtx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 480;

      rainGain = audioCtx.createGain();
      rainGain.gain.value = 0;

      src.connect(hp);
      hp.connect(rainFilter);
      rainFilter.connect(rainGain);
      rainGain.connect(audioCtx.destination);
      src.start(0);

      rainGain.gain.setTargetAtTime(
        soundEnabled ? rainGainTarget() : 0,
        audioCtx.currentTime,
        0.8
      );
    } catch (err) {
      audioCtx = null;
    }
  }

  function unlockAudio() {
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }
  window.addEventListener('pointerdown', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });

  function rainGainTarget() {
    return clamp(state.intensity, 0, 1) * 0.07;
  }

  function updateRainAudio() {
    if (!audioCtx || !rainGain) return;
    const target = soundEnabled ? rainGainTarget() : 0;
    rainGain.gain.setTargetAtTime(target, audioCtx.currentTime, 0.6);
    if (rainFilter) {
      rainFilter.frequency.setTargetAtTime(1800 + state.intensity * 3600, audioCtx.currentTime, 1.0);
    }
  }

  function playThunder(delay = 1.0) {
    if (!soundEnabled || !audioCtx || !noiseBuffer) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    try {
      const t = audioCtx.currentTime + delay;
      const src = audioCtx.createBufferSource();
      src.buffer = noiseBuffer;
      const lp = audioCtx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 130;
      lp.Q.value = 0.7;
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.45, t + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
      src.connect(lp);
      lp.connect(gain);
      gain.connect(audioCtx.destination);
      src.start(t);
      src.stop(t + 3.0);
    } catch (err) { /* 浏览器不允许时静默 */ }
  }

  function strike() {
    const bx = camera.position.x + (Math.random() * 140 - 70);
    const bz = camera.position.z - 120 - Math.random() * 100;
    let x = bx;
    let z = bz;
    for (let i = 0; i < 18; i++) {
      const y = 72 - i * 3.6 - Math.random() * 2;
      boltPositions[i * 3] = x;
      boltPositions[i * 3 + 1] = y;
      boltPositions[i * 3 + 2] = z;
      x += (Math.random() * 2 - 1) * 9;
      z += (Math.random() * 2 - 1) * 4;
    }
    boltGeo.attributes.position.needsUpdate = true;
    boltGeo.computeBoundingSphere();
    bolt.visible = true;
    boltMat.opacity = 1;
    boltLife = 0.18;
    flash = 1;
    lightning.intensity = 5.5;
    playThunder(0.7 + Math.random() * 1.3);
  }

  /* ---------- 实时天气 ---------- */
  async function refresh() {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    try {
      const res = await fetch(API, { signal: ctrl.signal, cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const c = data.current;
      if (!c) throw new Error('missing current');
      const d = decodeWeather(
        c.weather_code, c.cloud_cover, c.rain, c.showers,
        c.precipitation, c.visibility
      );

      state.type = d.type;
      state.label = d.label;
      state.code = c.weather_code;
      state.temp = c.temperature_2m;
      state.cloud = d.cloud;
      state.overcast = d.overcast;
      state.intensity = d.intensity;
      state.rain = d.intensity;
      state.precipitation = c.precipitation || 0;
      state.visibility = d.visibility;
      state.wind = c.wind_speed_10m || 0;
      state.haze = d.haze;
      state.storm = d.storm;
      state.source = 'open-meteo';
      state.updatedAt = Date.now();
      state.loaded = true;
      state.error = '';

      if (!nextStrike) nextStrike = 0;
    } catch (err) {
      state.error = err && err.message ? err.message : 'weather fetch failed';
      if (!state.loaded) {
        state.source = 'fallback';
        state.label = '多云';
        state.type = 'cloudy';
        state.temp = null;
      }
      /* 页面初始化或网络抖动时首帧可能失败，30 秒后重试一次 */
      setTimeout(refresh, 30000);
    } finally {
      clearTimeout(timer);
    }
  }

  refresh();
  const timer = setInterval(refresh, 10 * 60 * 1000);
  if (timer.unref) timer.unref();

  function forceStorm(seconds = 30) {
    forcedStormUntil = performance.now() / 1000 + seconds;
    state.type = 'storm';
    state.label = '雷雨';
    state.storm = true;
    state.intensity = 0.95;
    state.rain = 0.95;
    state.overcast = 0.95;
    state.cloud = 1;
    state.source = 'forced';
    state.loaded = true;
  }

  function setSoundEnabled(on) {
    soundEnabled = !!on;
    if (audioCtx && rainGain) {
      rainGain.gain.setTargetAtTime(
        soundEnabled ? rainGainTarget() : 0,
        audioCtx.currentTime,
        0.35
      );
    }
  }

  function update(dt, elapsed) {
    if (forcedStormUntil > 0 && performance.now() / 1000 < forcedStormUntil) {
      state.storm = true;
      state.intensity = Math.max(state.intensity, 0.9);
      state.rain = state.intensity;
    } else if (state.source === 'forced') {
      forcedStormUntil = 0;
      state.source = 'open-meteo';
      state.storm = false;
      refresh();
    }

    const intensity = clamp(state.intensity, 0, 1);

    /* 雨点跟随镜头，落下后回收 */
    rain.position.set(camera.position.x, 0, camera.position.z);
    const count = Math.floor(RAIN_COUNT * clamp(intensity * 1.55, 0, 1));
    rain.visible = count > 0;
    rainGeo.setDrawRange(0, count);
    if (count > 0) {
      const attr = rainGeo.attributes.position;
      const arr = attr.array;
      const windX = state.wind * 0.075;
      for (let i = 0; i < count; i++) {
        let x = arr[i * 3] + windX * dt;
        let y = arr[i * 3 + 1] - rainVel[i] * dt;
        if (y < 0) {
          y += RAIN_HEIGHT;
          x = (Math.random() * 2 - 1) * RAIN_AREA;
          arr[i * 3 + 2] = (Math.random() * 2 - 1) * RAIN_AREA;
        }
        if (x > RAIN_AREA) x -= RAIN_AREA * 2;
        else if (x < -RAIN_AREA) x += RAIN_AREA * 2;
        arr[i * 3] = x;
        arr[i * 3 + 1] = y;
      }
      attr.needsUpdate = true;
      rainMat.opacity = 0.42 + intensity * 0.32;
    }

    /* 闪电和天空闪光 */
    const stormy = state.storm || state.code >= 95 || intensity > 0.72;
    if (stormy) {
      if (nextStrike === 0) nextStrike = elapsed + 3 + Math.random() * 6;
      if (elapsed >= nextStrike) {
        strike();
        nextStrike = elapsed + 7 + Math.random() * 13;
      }
    } else {
      nextStrike = elapsed + 10;
    }

    flash = Math.max(0, flash - dt / 0.32);
    state.flash = flash;
    lightning.intensity = flash * 6;

    if (boltLife > 0) {
      boltLife -= dt;
      boltMat.opacity = clamp(boltLife / 0.18, 0, 1) * (0.7 + Math.random() * 0.3);
      bolt.visible = boltLife > 0;
    } else {
      bolt.visible = false;
    }

    updateRainAudio();
  }

  return {
    state,
    update,
    refresh,
    forceStorm,
    setSoundEnabled,
    strike,
  };
}
