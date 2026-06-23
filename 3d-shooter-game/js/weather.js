// ============================================================
// weather.js - 天气系统（雨、雪、星空渐变天空盒）
// ============================================================
import * as THREE from 'three';

// ===== 星空渐变天空盒 =====
export class StarSky {
  constructor(scene) {
    this.scene = scene;
    this.starField = null;
    this.backgroundCanvas = null;
    this.rotationSpeed = 0;
  }

  start(topColor = 0x0a0a2a, bottomColor = 0x1a1a3e, starCount = 1500) {
    // ---- 使用 Canvas 生成渐变纹理作为场景背景 ----
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    const top = new THREE.Color(topColor);
    const bottom = new THREE.Color(bottomColor);

    for (let y = 0; y < 512; y++) {
      const t = y / 511;
      const c = top.clone().lerp(bottom, t);
      ctx.fillStyle = '#' + c.getHexString();
      ctx.fillRect(0, y, 2, 1);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;

    // 使用渐变纹理作为场景背景（垂直渐变）
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = 2;
    bgCanvas.height = 512;
    const bgCtx = bgCanvas.getContext('2d');
    // 绘制从水平渐变到垂直渐变的背景
    for (let y = 0; y < 512; y++) {
      const t = y / 511;
      // 深蓝紫渐变
      const r = Math.round(8 + t * 18);
      const g = Math.round(8 + t * 12);
      const b = Math.round(32 + t * 30);
      bgCtx.fillStyle = `rgb(${r},${g},${b})`;
      bgCtx.fillRect(0, y, 2, 1);
    }

    const bgTexture = new THREE.CanvasTexture(bgCanvas);
    this.scene.background = bgTexture;

    // ---- 星星粒子系统 ----
    const positions = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    const brightness = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      // 均匀分布在大球面上方区域（上半球更密集）
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.85); // 主要在上半球
      const radius = 180 + Math.random() * 50;

      positions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius;
      positions[i * 3 + 1] = Math.cos(phi) * radius * 0.8 + 20; // 上移
      positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;

      sizes[i] = 0.2 + Math.random() * 0.8;
      brightness[i] = 0.3 + Math.random() * 0.7;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // 使用自定义着色器实现星星闪烁
    const vertexShader = `
      attribute float size;
      varying float vBright;
      uniform float uTime;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (120.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
        // 闪烁：每个星星的亮度按正弦变化，相位由位置决定
        float phase = position.x * 0.1 + position.y * 0.05 + position.z * 0.08;
        vBright = 0.4 + 0.6 * abs(sin(uTime * 0.5 + phase));
      }
    `;
    const fragmentShader = `
      varying float vBright;
      void main() {
        vec2 center = gl_PointCoord - vec2(0.5);
        float dist = length(center);
        if (dist > 0.5) discard;
        // 柔和圆点
        float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
        alpha *= vBright;
        gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
      }
    `;

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.starField = new THREE.Points(geo, mat);
    this.starField.position.y = 0;
    this.scene.add(this.starField);

    // 记录以便清理
    this.backgroundCanvas = bgCanvas;
  }

  update(dt) {
    if (this.starField) {
      // 缓慢旋转星群
      this.starField.rotation.y += dt * 0.008;
      // 更新闪烁
      if (this.starField.material.uniforms) {
        this.starField.material.uniforms.uTime.value += dt;
      }
    }
  }

  stop() {
    if (this.starField) {
      this.scene.remove(this.starField);
      this.starField.geometry.dispose();
      this.starField.material.dispose();
      this.starField = null;
    }
    // 恢复默认背景
    this.scene.background = new THREE.Color(0x1a1a2e);
  }
}

// ===== 下雨系统 =====
export class RainSystem {
  constructor(scene) {
    this.scene = scene;
    this.count = 4000;
    this.active = false;
    this.mesh = null;
    this.splashMeshes = [];
    this.velocities = [];
    this.area = 120;
    this.windOffset = new THREE.Vector2(-2, -1); // 风向偏移 (x, z)
  }

  start() {
    if (this.active) return;
    this.active = true;

    const positions = new Float32Array(this.count * 3);
    const velocities = new Float32Array(this.count);

    for (let i = 0; i < this.count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * this.area;
      positions[i * 3 + 1] = Math.random() * 40;
      positions[i * 3 + 2] = (Math.random() - 0.5) * this.area;
      velocities[i] = 25 + Math.random() * 10;
    }
    this.velocities = velocities;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // 使用纹理让雨滴呈细长线条
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(170, 204, 255, 0)';
    ctx.fillRect(0, 0, 4, 32);
    ctx.fillStyle = 'rgba(170, 204, 255, 0.8)';
    ctx.fillRect(1, 0, 2, 32);
    ctx.fillStyle = 'rgba(200, 220, 255, 1)';
    ctx.fillRect(1, 0, 2, 8);
    const rainTexture = new THREE.CanvasTexture(canvas);

    const mat = new THREE.PointsMaterial({
      color: 0xaaccff,
      map: rainTexture,
      size: 0.25,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.mesh = new THREE.Points(geo, mat);
    this.mesh.position.y = 0;
    this.scene.add(this.mesh);

    // ---- 地面溅射效果 ----
    this.createSplashEffects();
  }

  createSplashEffects() {
    for (let i = 0; i < 8; i++) {
      const splashCount = 60;
      const sp = new Float32Array(splashCount * 3);
      const offsets = new Float32Array(splashCount);

      for (let j = 0; j < splashCount; j++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 0.1 + Math.random() * 0.4;
        sp[j * 3] = (Math.random() - 0.5) * this.area;
        sp[j * 3 + 1] = Math.random() * 0.3;
        sp[j * 3 + 2] = (Math.random() - 0.5) * this.area;
        offsets[j] = Math.random() * Math.PI * 2;
      }

      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));

      const splashCanvas = document.createElement('canvas');
      splashCanvas.width = 16;
      splashCanvas.height = 16;
      const sCtx = splashCanvas.getContext('2d');
      const gradient = sCtx.createRadialGradient(8, 8, 0, 8, 8, 8);
      gradient.addColorStop(0, 'rgba(200, 220, 255, 0.4)');
      gradient.addColorStop(0.3, 'rgba(170, 200, 255, 0.2)');
      gradient.addColorStop(1, 'rgba(170, 200, 255, 0)');
      sCtx.fillStyle = gradient;
      sCtx.fillRect(0, 0, 16, 16);
      const splashTexture = new THREE.CanvasTexture(splashCanvas);

      const sm = new THREE.PointsMaterial({
        color: 0xaaccff,
        map: splashTexture,
        size: 0.15,
        transparent: true,
        opacity: 0.15,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      });

      const smesh = new THREE.Points(sg, sm);
      this.scene.add(smesh);
      this.splashMeshes.push({
        mesh: smesh,
        phase: Math.random() * Math.PI * 2,
        density: 0.3 + Math.random() * 0.2,
      });
    }
  }

  update(dt, playerPos) {
    if (!this.active || !this.mesh) return;

    const pos = this.mesh.geometry.attributes.position.array;
    const cx = playerPos ? playerPos.x : 0;
    const cz = playerPos ? playerPos.z : 0;

    for (let i = 0; i < this.count; i++) {
      // 下落
      pos[i * 3 + 1] -= this.velocities[i] * dt;
      // 风偏移
      pos[i * 3] += this.windOffset.x * dt;
      pos[i * 3 + 2] += this.windOffset.y * dt;

      // 到底重置
      if (pos[i * 3 + 1] < 0) {
        pos[i * 3] = cx + (Math.random() - 0.5) * this.area;
        pos[i * 3 + 1] = 30 + Math.random() * 10;
        pos[i * 3 + 2] = cz + (Math.random() - 0.5) * this.area;
      }
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;

    // ---- 更新溅射效果 ----
    const time = performance.now() * 0.001;
    for (let i = 0; i < this.splashMeshes.length; i++) {
      const s = this.splashMeshes[i];
      const sp = s.mesh.geometry.attributes.position.array;
      const splashTimer = time * 3 + s.phase;

      for (let j = 0; j < sp.length / 3; j++) {
        // 溅射粒子随机跳动（模拟水花溅起）
        const bounce = Math.abs(Math.sin(splashTimer + j * 0.7)) * 0.15;
        sp[j * 3 + 1] = bounce;

        // 轻微扩散
        sp[j * 3] += (Math.random() - 0.5) * 0.3 * dt * 10;
        sp[j * 3 + 2] += (Math.random() - 0.5) * 0.3 * dt * 10;

        // 保持在玩家附近区域
        if (Math.abs(sp[j * 3] - cx) > this.area / 2) {
          sp[j * 3] = cx + (Math.random() - 0.5) * this.area;
        }
        if (Math.abs(sp[j * 3 + 2] - cz) > this.area / 2) {
          sp[j * 3 + 2] = cz + (Math.random() - 0.5) * this.area;
        }
      }
      s.mesh.geometry.attributes.position.needsUpdate = true;

      // 溅射透明度呼吸
      s.mesh.material.opacity = 0.08 + 0.12 * (0.5 + 0.5 * Math.sin(time * 2 + s.phase));
    }
  }

  stop() {
    this.active = false;
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
    }
    for (const s of this.splashMeshes) {
      this.scene.remove(s.mesh);
      s.mesh.geometry.dispose();
      s.mesh.material.dispose();
    }
    this.splashMeshes = [];
  }
}

// ===== 下雪系统 =====
export class SnowSystem {
  constructor(scene) {
    this.scene = scene;
    this.count = 2000;
    this.active = false;
    this.mesh = null;
    this.velocities = [];
    this.wobble = [];
    this.area = 120;
    this.windOffset = new THREE.Vector2(-1, -0.5); // 雪的风更轻柔
  }

  start() {
    if (this.active) return;
    this.active = true;

    const positions = new Float32Array(this.count * 3);
    const vels = new Float32Array(this.count);
    const wobbles = new Float32Array(this.count);

    for (let i = 0; i < this.count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * this.area;
      positions[i * 3 + 1] = Math.random() * 35;
      positions[i * 3 + 2] = (Math.random() - 0.5) * this.area;
      vels[i] = 1.5 + Math.random() * 3.5;
      wobbles[i] = Math.random() * Math.PI * 2;
    }
    this.velocities = vels;
    this.wobble = wobbles;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // 雪花纹理（六边形柔化圆点）
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');

    // 柔化圆点纹理
    const gradient = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.4)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 16, 16);
    const snowTexture = new THREE.CanvasTexture(canvas);

    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      map: snowTexture,
      size: 0.25,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.mesh = new THREE.Points(geo, mat);
    this.scene.add(this.mesh);
  }

  update(dt, playerPos) {
    if (!this.active || !this.mesh) return;

    const pos = this.mesh.geometry.attributes.position.array;
    const cx = playerPos ? playerPos.x : 0;
    const cz = playerPos ? playerPos.z : 0;
    const time = Date.now() * 0.001;

    // 尺寸随高度微调（高层雪花稍大）
    const sizeAttenuation = 0.2 + 0.1 * Math.sin(time * 0.3);

    for (let i = 0; i < this.count; i++) {
      // 缓慢下落
      pos[i * 3 + 1] -= this.velocities[i] * dt;

      // 左右摇摆（布朗运动风格）
      const wobbleX = Math.sin(time * 0.8 + this.wobble[i]) * 0.3;
      const wobbleZ = Math.cos(time * 0.6 + this.wobble[i] * 0.7) * 0.3;
      pos[i * 3] += (wobbleX + this.windOffset.x * 0.3) * dt;
      pos[i * 3 + 2] += (wobbleZ + this.windOffset.y * 0.3) * dt;

      // 触底重置
      if (pos[i * 3 + 1] < 0) {
        pos[i * 3] = cx + (Math.random() - 0.5) * this.area;
        pos[i * 3 + 1] = 28 + Math.random() * 7;
        pos[i * 3 + 2] = cz + (Math.random() - 0.5) * this.area;
        // 重置摇摆相位避免同步
        this.wobble[i] = Math.random() * Math.PI * 2;
      }
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;

    // 粒子大小随下落呼吸变化
    const breathe = 0.22 + 0.06 * Math.sin(time * 0.5);
    this.mesh.material.size = breathe;
  }

  stop() {
    this.active = false;
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
    }
  }
}

// ===== 天气管理器 =====
export class WeatherManager {
  constructor(scene) {
    this.scene = scene;
    this.starSky = new StarSky(scene);
    this.rain = new RainSystem(scene);
    this.snow = new SnowSystem(scene);
    this.currentWeather = 'clear'; // 'clear' | 'rain' | 'snow'
    this.lastChange = 0;
    this.changeInterval = 30; // 30秒自动轮换（调试用）
    this.autoCycle = false;
    this.hasSky = false;
  }

  /** 初始化星空背景（应在场景创建后调用一次） */
  initSky() {
    if (!this.hasSky) {
      this.starSky.start(0x05051a, 0x12122e, 1500);
      this.hasSky = true;
    }
  }

  /** 切换天气 */
  setWeather(type) {
    if (type === this.currentWeather) return;

    // 停止当前
    this.rain.stop();
    this.snow.stop();

    this.currentWeather = type;

    // 确保星空已启动
    if (!this.hasSky) {
      this.initSky();
    }

    switch (type) {
      case 'rain':
        this.rain.start();
        // 雨天使天空变暗
        if (this.starSky.starField) {
          this.starSky.starField.material.uniforms.uTime.value += 10;
          this.starSky.starField.material.opacity = 0.5;
        }
        break;
      case 'snow':
        this.snow.start();
        // 雪天使天空微亮
        if (this.starSky.starField) {
          this.starSky.starField.material.opacity = 0.8;
        }
        break;
      case 'clear':
        // 恢复
        if (this.starSky.starField) {
          this.starSky.starField.material.opacity = 1.0;
        }
        break;
    }
  }

  /** 设置自动轮换间隔（秒），0 表示关闭自动轮换 */
  setAutoCycle(interval = 30) {
    if (interval > 0) {
      this.autoCycle = true;
      this.changeInterval = interval;
      this.lastChange = performance.now();
    } else {
      this.autoCycle = false;
    }
  }

  /** 每帧调用 */
  update(dt, playerPos) {
    // 更新星空
    this.starSky.update(dt);

    // 自动轮换
    if (this.autoCycle) {
      const now = performance.now();
      if (now - this.lastChange > this.changeInterval * 1000) {
        this.lastChange = now;
        const types = ['clear', 'rain', 'snow', 'rain'];
        const next = types[Math.floor(Math.random() * types.length)];
        this.setWeather(next);
      }
    }

    this.rain.update(dt, playerPos);
    this.snow.update(dt, playerPos);
  }

  /** 完全停止所有天气和星空 */
  stop() {
    this.rain.stop();
    this.snow.stop();
    this.starSky.stop();
    this.hasSky = false;
    this.currentWeather = 'clear';
  }

  /** 仅停止天气（保留星空） */
  stopWeather() {
    this.rain.stop();
    this.snow.stop();
    this.currentWeather = 'clear';
  }
}
