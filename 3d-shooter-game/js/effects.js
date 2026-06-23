// ============================================================
// effects.js - 武器特效模块: 枪口火焰、弹壳弹出、击中火花、
//              屏幕震动、枪口烟雾、弹孔、弹道轨迹
// ============================================================
import * as THREE from 'three';

// ===== 工具: 生成纹理 =====
const _texCache = {};

function getGlowTexture() {
    if (_texCache.glow) return _texCache.glow;
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,200,1)');
    g.addColorStop(0.25, 'rgba(255,200,80,0.7)');
    g.addColorStop(0.5, 'rgba(255,120,40,0.3)');
    g.addColorStop(1, 'rgba(255,60,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    _texCache.glow = new THREE.CanvasTexture(c);
    return _texCache.glow;
}

function getSmokeTexture() {
    if (_texCache.smoke) return _texCache.smoke;
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(200,200,200,0.5)');
    g.addColorStop(0.4, 'rgba(160,160,160,0.3)');
    g.addColorStop(0.7, 'rgba(120,120,120,0.1)');
    g.addColorStop(1, 'rgba(80,80,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    _texCache.smoke = new THREE.CanvasTexture(c);
    return _texCache.smoke;
}

function getStarTexture() {
    if (_texCache.star) return _texCache.star;
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    // 4-pointed star
    ctx.translate(32, 32);
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r = i % 2 === 0 ? 28 : 8;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 28);
    g.addColorStop(0, 'rgba(255,255,220,1)');
    g.addColorStop(0.3, 'rgba(255,200,100,0.8)');
    g.addColorStop(0.6, 'rgba(255,150,50,0.3)');
    g.addColorStop(1, 'rgba(255,100,30,0)');
    ctx.fillStyle = g;
    ctx.fill();
    _texCache.star = new THREE.CanvasTexture(c);
    return _texCache.star;
}

// ================================================================
// 1. MuzzleFlash — 枪口火焰
// ================================================================
export class MuzzleFlash {
    /**
     * @param {THREE.Scene} scene
     * @param {object} [opts]
     * @param {number} [opts.intensity=1]   亮度倍率
     * @param {number} [opts.scale=1]       尺寸倍率
     * @param {number} [opts.color=0xffff88] 主色
     */
    constructor(scene, opts = {}) {
        this.scene = scene;
        this.intensity = opts.intensity ?? 1;
        this.scale = opts.scale ?? 1;
        this.color = opts.color ?? 0xffff88;

        /** @type {{ mesh: THREE.Object3D, life: number, born: number }[]} */
        this.active = [];
    }

    /**
     * 在 position 处产生枪口火焰
     * @param {THREE.Vector3} position   世界坐标
     * @param {THREE.Vector3} [direction] 枪口朝向（可选，影响火焰形状朝向）
     */
    emit(position, direction) {
        const s = this.scale;
        const n = this.intensity;
        const c = this.color;
        const now = performance.now();

        // ---- 核心球（主闪光） ----
        const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(0.12 * s, 6, 6),
            new THREE.MeshBasicMaterial({
                color: c,
                transparent: true,
                opacity: 0.95 * n,
                depthWrite: false,
            })
        );
        sphere.position.copy(position);
        this.scene.add(sphere);
        this.active.push({ mesh: sphere, life: 35, born: now });

        // ---- 星形光晕 Sprite（大号） ----
        const starMat = new THREE.SpriteMaterial({
            map: getStarTexture(),
            blending: THREE.AdditiveBlending,
            transparent: true,
            opacity: 0.9 * n,
            depthWrite: false,
            color: c,
        });
        const starSprite = new THREE.Sprite(starMat);
        starSprite.position.copy(position);
        starSprite.scale.set(0.9 * s, 0.9 * s, 1);
        this.scene.add(starSprite);
        this.active.push({ mesh: starSprite, life: 50, born: now });

        // ---- 径向光晕 Sprite（暖色扩散） ----
        const glowMat = new THREE.SpriteMaterial({
            map: getGlowTexture(),
            blending: THREE.AdditiveBlending,
            transparent: true,
            opacity: 0.7 * n,
            depthWrite: false,
        });
        const glowSprite = new THREE.Sprite(glowMat);
        glowSprite.position.copy(position);
        glowSprite.scale.set(1.2 * s, 1.2 * s, 1);
        this.scene.add(glowSprite);
        this.active.push({ mesh: glowSprite, life: 60, born: now });

        // ---- 点光源（照亮周围） ----
        const light = new THREE.PointLight(c, 3 * n, 6 * s);
        light.position.copy(position);
        this.scene.add(light);
        this.active.push({ mesh: light, life: 70, born: now });

        // ---- 如果提供了方向，添加尖端火焰（偏向前方的小锥体） ----
        if (direction) {
            const tipMat = new THREE.MeshBasicMaterial({
                color: 0xffaa44,
                transparent: true,
                opacity: 0.8 * n,
                depthWrite: false,
                side: THREE.DoubleSide,
            });
            const tip = new THREE.Mesh(
                new THREE.ConeGeometry(0.08 * s, 0.2 * s, 4),
                tipMat
            );
            tip.position.copy(position);
            // 朝向 direction
            const up = new THREE.Vector3(0, 1, 0);
            const quat = new THREE.Quaternion().setFromUnitVectors(up, direction.clone().normalize());
            tip.quaternion.copy(quat);
            tip.position.add(direction.clone().normalize().multiplyScalar(0.1 * s));
            this.scene.add(tip);
            this.active.push({ mesh: tip, life: 30, born: now });
        }
    }

    update(dt) {
        const now = performance.now();
        for (let i = this.active.length - 1; i >= 0; i--) {
            const e = this.active[i];
            const age = now - e.born;
            if (age > e.life) {
                this.scene.remove(e.mesh);
                if (e.mesh.isPointLight) {
                    // PointLight 不需要 dispose geometry/material
                }
                this.active.splice(i, 1);
                continue;
            }
            const t = age / e.life; // 0->1

            if (e.mesh.isMesh && e.mesh.material) {
                e.mesh.material.opacity = (1 - t * t) * this.intensity;
            }
            if (e.mesh.isSprite) {
                e.mesh.material.opacity = (1 - t) * this.intensity;
                const baseScale = 0.9 * this.scale;
                e.mesh.scale.setScalar(baseScale * (1 + t * 0.6));
            }
            if (e.mesh.isPointLight) {
                e.mesh.intensity = 3 * this.intensity * (1 - t);
            }
        }
    }

    clear() {
        for (const e of this.active) this.scene.remove(e.mesh);
        this.active = [];
    }
}

// ================================================================
// 2. ShellCasing — 弹壳弹出
// ================================================================
export class ShellCasing {
    /**
     * @param {THREE.Scene} scene
     * @param {object} [opts]
     * @param {number} [opts.life=3000]  最长存活 ms
     * @param {number} [opts.count=1]    每次弹出数量
     */
    constructor(scene, opts = {}) {
        this.scene = scene;
        this.life = opts.life ?? 3000;
        this.count = opts.count ?? 1;

        /** @type {{ mesh: THREE.Mesh, pos: THREE.Vector3, vel: THREE.Vector3,
         *           rot: THREE.Vector3, born: number, life: number,
         *           bounceCount: number }[]} */
        this.active = [];

        // 共享几何体（减少 GC）
        this._geo = new THREE.CylinderGeometry(0.018, 0.022, 0.055, 6);
    }

    /**
     * @param {THREE.Vector3} position  枪口世界位置
     * @param {THREE.Vector3} gunDir    枪口方向（用于推算抛出方向）
     */
    emit(position, gunDir) {
        const count = this.count;
        const g = this._geo;

        for (let i = 0; i < count; i++) {
            const mat = new THREE.MeshStandardMaterial({
                color: new THREE.Color().setHSL(0.08 + Math.random() * 0.03, 0.6, 0.5 + Math.random() * 0.15),
                metalness: 0.85,
                roughness: 0.25,
            });
            const shell = new THREE.Mesh(g, mat);

            // 抛出方向：沿枪口朝向的侧上方，带随机
            // 右向 = gunDir 的叉积 与 up
            const up = new THREE.Vector3(0, 1, 0);
            const side = new THREE.Vector3().crossVectors(gunDir, up).normalize();
            if (side.length() < 0.01) {
                // gunDir 朝上时退化为 z 方向
                side.set(0, 0, 1);
            }
            // 少量向前 + 侧向 + 向上
            const ejectDir = new THREE.Vector3()
                .addScaledVector(gunDir, 0.1)
                .addScaledVector(side, 0.6 + Math.random() * 0.2)
                .addScaledVector(up, 0.3 + Math.random() * 0.2)
                .normalize();

            const startPos = position.clone().add(
                side.clone().multiplyScalar(0.15 + Math.random() * 0.05)
            );
            startPos.y += 0.1;

            shell.position.copy(startPos);
            shell.rotation.set(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            );
            shell.castShadow = true;
            this.scene.add(shell);

            this.active.push({
                mesh: shell,
                pos: startPos.clone(),
                vel: ejectDir.multiplyScalar(2.5 + Math.random() * 1.5).add(new THREE.Vector3(0, 3 + Math.random() * 1.5, 0)),
                rot: new THREE.Vector3(
                    (Math.random() - 0.5) * 20,
                    (Math.random() - 0.5) * 20,
                    (Math.random() - 0.5) * 20
                ),
                born: performance.now(),
                life: this.life + Math.random() * 1000,
                bounceCount: 0,
            });
        }
    }

    update(dt) {
        const now = performance.now();
        for (let i = this.active.length - 1; i >= 0; i--) {
            const s = this.active[i];
            const age = now - s.born;
            if (age > s.life) {
                this.scene.remove(s.mesh);
                // dispose material
                if (s.mesh.material) s.mesh.material.dispose();
                this.active.splice(i, 1);
                continue;
            }

            // 重力
            s.vel.y -= 18 * dt;
            // 空气阻力（让弹壳更快落地）
            s.vel.multiplyScalar(1 - 0.5 * dt);

            s.pos.addScaledVector(s.vel, dt);

            // 地面碰撞
            if (s.pos.y < 0 && s.vel.y < 0) {
                s.pos.y = 0;
                s.vel.y *= -0.25;
                s.vel.x *= 0.5;
                s.vel.z *= 0.5;
                s.bounceCount++;
                // 停在地面后减速旋转
                s.rot.multiplyScalar(0.3);
                if (s.bounceCount > 3) {
                    s.vel.set(0, 0, 0);
                    s.rot.set(0, 0, 0);
                }
            }

            s.mesh.position.copy(s.pos);
            s.mesh.rotation.x += s.rot.x * dt;
            s.mesh.rotation.y += s.rot.y * dt;
            s.mesh.rotation.z += s.rot.z * dt;

            // 存活超过 80% 寿命时淡出
            if (age > s.life * 0.8) {
                const fadeT = (age - s.life * 0.8) / (s.life * 0.2);
                s.mesh.material.opacity = 1 - fadeT;
                s.mesh.material.transparent = true;
            }
        }
    }

    clear() {
        for (const s of this.active) {
            this.scene.remove(s.mesh);
            if (s.mesh.material) s.mesh.material.dispose();
        }
        this.active = [];
    }
}

// ================================================================
// 3. ImpactSpark — 击中火花
// ================================================================
export class ImpactSpark {
    /**
     * @param {THREE.Scene} scene
     * @param {object} [opts]
     * @param {number} [opts.particleCount=8] 每击粒子数
     * @param {number} [opts.speed=4]         粒子初速
     * @param {number} [opts.life=300]        粒子生存 ms
     * @param {number} [opts.color=0xffcc44]   粒子颜色
     */
    constructor(scene, opts = {}) {
        this.scene = scene;
        this.particleCount = opts.particleCount ?? 8;
        this.speed = opts.speed ?? 4;
        this.life = opts.life ?? 300;
        this.color = opts.color ?? 0xffcc44;

        /** @type {{ mesh: THREE.Mesh, pos: THREE.Vector3, vel: THREE.Vector3,
         *           born: number, life: number }[]} */
        this.active = [];
    }

    /**
     * @param {THREE.Vector3} position 击中点
     * @param {THREE.Vector3} [normal] 表面法线（粒子偏向法线方向）
     */
    emit(position, normal) {
        const count = this.particleCount + Math.floor(Math.random() * 4);
        const spd = this.speed;
        const color = this.color;
        const life = this.life;

        for (let i = 0; i < count; i++) {
            // 用小立方体代替球体，更亮眼
            const mat = new THREE.MeshBasicMaterial({
                color: i % 2 === 0 ? color : 0xffffff,
            });
            const spark = new THREE.Mesh(
                new THREE.BoxGeometry(0.025, 0.025, 0.025),
                mat
            );
            spark.position.copy(position);
            this.scene.add(spark);

            // 速度方向：如果提供法线，粒子偏向法线方向 + 随机扩散
            let dir;
            if (normal) {
                dir = new THREE.Vector3(
                    normal.x + (Math.random() - 0.5) * 1.2,
                    normal.y + Math.random() * 0.6,
                    normal.z + (Math.random() - 0.5) * 1.2
                ).normalize();
            } else {
                dir = new THREE.Vector3(
                    (Math.random() - 0.5) * 2,
                    Math.random() * 0.8 + 0.2,
                    (Math.random() - 0.5) * 2
                ).normalize();
            }

            this.active.push({
                mesh: spark,
                pos: position.clone(),
                vel: dir.multiplyScalar(spd * (0.6 + Math.random() * 0.8)),
                born: performance.now(),
                life: life * (0.5 + Math.random() * 0.5),
            });
        }
    }

    update(dt) {
        const now = performance.now();
        for (let i = this.active.length - 1; i >= 0; i--) {
            const s = this.active[i];
            const age = now - s.born;
            if (age > s.life) {
                this.scene.remove(s.mesh);
                if (s.mesh.material) s.mesh.material.dispose();
                this.active.splice(i, 1);
                continue;
            }
            // 重力
            s.vel.y -= 15 * dt;
            s.pos.addScaledVector(s.vel, dt);

            // 地面碰撞（火花会弹跳）
            if (s.pos.y < 0) {
                s.pos.y = 0;
                s.vel.y *= -0.4;
                s.vel.x *= 0.7;
                s.vel.z *= 0.7;
                if (Math.abs(s.vel.y) < 0.5) s.vel.y = 0;
            }

            s.mesh.position.copy(s.pos);

            // 粒子旋转（随机增添动态）
            s.mesh.rotation.x += dt * 10;
            s.mesh.rotation.y += dt * 8;

            // 淡出 + 缩小
            const t = age / s.life;
            s.mesh.material.opacity = 1 - t * t;
            s.mesh.material.transparent = true;
            const sc = 1 - t * 0.8;
            s.mesh.scale.setScalar(sc);
        }
    }

    clear() {
        for (const s of this.active) {
            this.scene.remove(s.mesh);
            if (s.mesh.material) s.mesh.material.dispose();
        }
        this.active = [];
    }
}

// ================================================================
// 4. ScreenShake — 屏幕震动
// ================================================================
export class ScreenShake {
    /**
     * @param {THREE.Camera} camera
     * @param {object} [opts]
     * @param {number} [opts.decay=8]      衰减速度 (单位/秒)
     * @param {number} [opts.maxShake=0.4]  最大震动幅度
     */
    constructor(camera, opts = {}) {
        this.camera = camera;
        this.decay = opts.decay ?? 8;
        this.maxShake = opts.maxShake ?? 0.4;

        this._amount = 0;
        this._offset = new THREE.Vector3();
        // 保存初始 camera 位置（由外部在每帧设置基准位）
        this._basePosition = new THREE.Vector3();
    }

    /**
     * 在每帧更新 camera 前调用，记录无震动的基准位置
     * @param {THREE.Vector3} basePos
     */
    setBasePosition(basePos) {
        this._basePosition.copy(basePos);
    }

    /**
     * 添加震动量（累计）
     * @param {number} amount 0~1
     */
    add(amount) {
        this._amount = Math.min(this._amount + amount, this.maxShake);
    }

    update(dt) {
        if (this._amount <= 0.001) {
            this._amount = 0;
            // 恢复到基准位置（如果没有其他偏移）
            return;
        }

        // 在基准位置上叠加随机偏移
        this._offset.set(
            (Math.random() - 0.5) * 2 * this._amount,
            (Math.random() - 0.5) * 2 * this._amount,
            0
        );

        this.camera.position.copy(this._basePosition).add(this._offset);

        // 指数衰减
        this._amount *= Math.exp(-this.decay * dt);
        if (this._amount < 0.001) this._amount = 0;
    }

    get amount() { return this._amount; }

    clear() {
        this._amount = 0;
        this._offset.set(0, 0, 0);
    }
}

// ================================================================
// 5. MuzzleSmoke — 枪口烟雾
// ================================================================
export class MuzzleSmoke {
    /**
     * @param {THREE.Scene} scene
     * @param {object} [opts]
     * @param {number} [opts.life=1500]   烟雾持续 ms
     * @param {number} [opts.scale=1]     尺寸倍率
     * @param {number} [opts.count=1]     每次产生烟雾数
     */
    constructor(scene, opts = {}) {
        this.scene = scene;
        this.life = opts.life ?? 1500;
        this.scale = opts.scale ?? 1;
        this.count = opts.count ?? 1;

        /** @type {{ mesh: THREE.Sprite, pos: THREE.Vector3,
         *           vel: THREE.Vector3, born: number, life: number,
         *           initialScale: number }[]} */
        this.active = [];

        this._smokeTex = getSmokeTexture();
    }

    /**
     * @param {THREE.Vector3} position  枪口位置
     * @param {THREE.Vector3} gunDir    枪口方向（烟雾沿枪口方向飘散）
     */
    emit(position, gunDir) {
        const s = this.scale;
        const count = this.count;
        const tex = this._smokeTex;

        for (let i = 0; i < count; i++) {
            const mat = new THREE.SpriteMaterial({
                map: tex,
                blending: THREE.NormalBlending,
                transparent: true,
                opacity: 0.35,
                depthWrite: false,
                color: new THREE.Color().setHSL(0, 0, 0.4 + Math.random() * 0.2),
            });
            const sprite = new THREE.Sprite(mat);

            // 初始位置：枪口附近随机偏移
            const offset = new THREE.Vector3(
                (Math.random() - 0.5) * 0.1,
                Math.random() * 0.1,
                (Math.random() - 0.5) * 0.1
            );
            sprite.position.copy(position).add(offset);

            const initScale = (0.12 + Math.random() * 0.1) * s;
            sprite.scale.set(initScale, initScale, 1);
            this.scene.add(sprite);

            // 速度：沿枪口方向 + 向上浮力 + 随机扩散
            const vel = new THREE.Vector3()
                .addScaledVector(gunDir || new THREE.Vector3(0, 0, -1), 0.3 + Math.random() * 0.4)
                .add(new THREE.Vector3(0, 1.2 + Math.random() * 0.8, 0))
                .add(new THREE.Vector3(
                    (Math.random() - 0.5) * 0.5,
                    0,
                    (Math.random() - 0.5) * 0.5
                ));

            this.active.push({
                mesh: sprite,
                pos: sprite.position.clone(),
                vel,
                born: performance.now(),
                life: this.life * (0.7 + Math.random() * 0.3),
                initialScale: initScale,
            });
        }
    }

    update(dt) {
        const now = performance.now();
        for (let i = this.active.length - 1; i >= 0; i--) {
            const s = this.active[i];
            const age = now - s.born;
            if (age > s.life) {
                this.scene.remove(s.mesh);
                if (s.mesh.material) s.mesh.material.dispose();
                this.active.splice(i, 1);
                continue;
            }

            const t = age / s.life; // 0->1

            // 上升速度逐渐减慢（扩散为主）
            s.vel.y *= (1 - 0.3 * dt);
            s.vel.x *= (1 - 0.2 * dt);
            s.vel.z *= (1 - 0.2 * dt);

            s.pos.addScaledVector(s.vel, dt);
            s.mesh.position.copy(s.pos);

            // 烟雾逐渐变大
            const scaleGrowth = 1 + t * 4;
            s.mesh.scale.setScalar(s.initialScale * scaleGrowth);

            // 透明度：先浓后淡
            if (t < 0.15) {
                // 升起阶段变浓
                s.mesh.material.opacity = 0.35 * (t / 0.15);
            } else {
                // 扩散消散
                const fade = (t - 0.15) / (1 - 0.15);
                s.mesh.material.opacity = 0.35 * (1 - fade * fade);
            }
        }
    }

    clear() {
        for (const s of this.active) {
            this.scene.remove(s.mesh);
            if (s.mesh.material) s.mesh.material.dispose();
        }
        this.active = [];
    }
}

// ================================================================
// 6. BulletHole — 弹孔（持久标记）
// ================================================================
export class BulletHole {
    /**
     * @param {THREE.Scene} scene
     * @param {object} [opts]
     * @param {number} [opts.decay=10000]   弹孔消失 ms，-1 表示永久
     * @param {number} [opts.maxHoles=50]   最大弹孔数
     */
    constructor(scene, opts = {}) {
        this.scene = scene;
        this.decay = opts.decay ?? 10000;
        this.maxHoles = opts.maxHoles ?? 50;

        /** @type {{ mesh: THREE.Mesh, born: number, life: number }[]} */
        this.active = [];
    }

    /**
     * @param {THREE.Vector3} position  击中位置
     * @param {THREE.Vector3} normal    表面法线
     * @param {THREE.Color|number} [color=0x222222]
     */
    emit(position, normal, color) {
        const c = color ?? 0x222222;

        // 小圆片弹孔
        const hole = new THREE.Mesh(
            new THREE.CircleGeometry(0.06, 6),
            new THREE.MeshBasicMaterial({
                color: c,
                transparent: true,
                opacity: 0.8,
                depthWrite: false,
                side: THREE.DoubleSide,
            })
        );
        hole.position.copy(position);
        // 朝向法线方向
        if (normal && normal.length() > 0.01) {
            const up = new THREE.Vector3(0, 1, 0);
            const quat = new THREE.Quaternion().setFromUnitVectors(up, normal.clone().normalize());
            hole.quaternion.copy(quat);
        }
        // 稍微偏移避免 Z-fighting
        if (normal) {
            hole.position.add(normal.clone().multiplyScalar(0.01));
        }
        this.scene.add(hole);

        this.active.push({
            mesh: hole,
            born: performance.now(),
            life: this.decay < 0 ? Infinity : this.decay,
        });

        // 超过上限时移除最旧的
        if (this.active.length > this.maxHoles) {
            const oldest = this.active.shift();
            this.scene.remove(oldest.mesh);
            if (oldest.mesh.material) oldest.mesh.material.dispose();
        }
    }

    update() {
        if (this.decay < 0) return; // 永久
        const now = performance.now();
        for (let i = this.active.length - 1; i >= 0; i--) {
            const h = this.active[i];
            if (now - h.born > h.life) {
                this.scene.remove(h.mesh);
                if (h.mesh.material) h.mesh.material.dispose();
                this.active.splice(i, 1);
            }
        }
    }

    clear() {
        for (const h of this.active) {
            this.scene.remove(h.mesh);
            if (h.mesh.material) h.mesh.material.dispose();
        }
        this.active = [];
    }
}

// ================================================================
// 7. TracerRound — 弹道光效
// ================================================================
export class TracerRound {
    /**
     * @param {THREE.Scene} scene
     * @param {object} [opts]
     * @param {number} [opts.life=100]    tracer 持续 ms
     * @param {number} [opts.maxTrails=30] 最大 tracer 数量
     */
    constructor(scene, opts = {}) {
        this.scene = scene;
        this.life = opts.life ?? 100;
        this.maxTrails = opts.maxTrails ?? 30;

        /** @type {{ mesh: THREE.Line, born: number }[]} */
        this.active = [];
    }

    /**
     * @param {THREE.Vector3} origin    起点
     * @param {THREE.Vector3} direction 方向（归一化向量）
     * @param {number} [length=30]      弹道长度
     * @param {THREE.Color} [color]     弹道颜色，默认为暖色
     */
    emit(origin, direction, length = 30, color) {
        const col = color || new THREE.Color(1, 0.9, 0.4);
        const end = origin.clone().add(direction.clone().multiplyScalar(length));

        // 弹道主线
        const points = [];
        const steps = 10;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const p = origin.clone().lerp(end, t);
            // 微小随机偏移（模拟弹道不稳定）
            if (i > 0 && i < steps) {
                p.x += (Math.random() - 0.5) * 0.03;
                p.y += (Math.random() - 0.5) * 0.03;
                p.z += (Math.random() - 0.5) * 0.03;
            }
            points.push(p);
        }

        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({
            color: col,
            transparent: true,
            opacity: 0.6,
            linewidth: 1,
        });
        const line = new THREE.Line(geo, mat);
        this.scene.add(line);

        this.active.push({ mesh: line, born: performance.now() });

        // 限制数量
        if (this.active.length > this.maxTrails) {
            const oldest = this.active.shift();
            this.scene.remove(oldest.mesh);
            oldest.mesh.geometry.dispose();
            oldest.mesh.material.dispose();
        }
    }

    update() {
        const now = performance.now();
        for (let i = this.active.length - 1; i >= 0; i--) {
            const t = this.active[i];
            const age = now - t.born;
            if (age > this.life) {
                this.scene.remove(t.mesh);
                t.mesh.geometry.dispose();
                t.mesh.material.dispose();
                this.active.splice(i, 1);
                continue;
            }
            // 尾部淡出
            t.mesh.material.opacity = 0.6 * (1 - age / this.life);
        }
    }

    clear() {
        for (const t of this.active) {
            this.scene.remove(t.mesh);
            t.mesh.geometry.dispose();
            t.mesh.material.dispose();
        }
        this.active = [];
    }
}

// ================================================================
// WeaponEffects — 聚合管理器，统一接口
// ================================================================
export class WeaponEffects {
    /**
     * @param {THREE.Scene} scene
     * @param {THREE.Camera} camera
     * @param {object} [opts]
     */
    constructor(scene, camera, opts = {}) {
        this.scene = scene;
        this.camera = camera;

        this.muzzleFlash = new MuzzleFlash(scene, opts.muzzleFlash);
        this.shellCasing = new ShellCasing(scene, opts.shellCasing);
        this.impactSpark = new ImpactSpark(scene, opts.impactSpark);
        this.screenShake = new ScreenShake(camera, opts.screenShake);
        this.muzzleSmoke = new MuzzleSmoke(scene, opts.muzzleSmoke);
        this.bulletHole = new BulletHole(scene, opts.bulletHole);
        this.tracer = new TracerRound(scene, opts.tracer);
    }

    /**
     * 一次射击触发所有相关特效
     * @param {THREE.Vector3} muzzlePos  枪口世界坐标
     * @param {THREE.Vector3} gunDir     枪口朝向（归一化向量）
     * @param {number} [shakeAmount=0.05] 屏幕震动幅度
     */
    fire(muzzlePos, gunDir, shakeAmount = 0.05) {
        this.muzzleFlash.emit(muzzlePos, gunDir);
        this.shellCasing.emit(muzzlePos, gunDir);
        this.muzzleSmoke.emit(muzzlePos, gunDir);
        this.screenShake.add(shakeAmount);
    }

    /**
     * 子弹命中目标
     * @param {THREE.Vector3} hitPos  击中点
     * @param {THREE.Vector3} hitNorm 击中表面法线
     * @param {THREE.Vector3} [bulletDir] 子弹方向（用于 tracer 终点）
     * @param {number} [damage] 伤害值（影响火花大小）
     */
    onHit(hitPos, hitNorm, bulletDir, damage) {
        this.impactSpark.emit(hitPos, hitNorm);
        this.bulletHole.emit(hitPos, hitNorm);

        // 根据伤害调整震动
        const shake = damage ? Math.min(damage * 0.002, 0.15) : 0.05;
        this.screenShake.add(shake);

        // 如果提供了子弹方向，画弹道终点光效
        if (bulletDir) {
            this.tracer.emit(
                hitPos.clone().sub(bulletDir.clone().multiplyScalar(5)),
                bulletDir,
                5,
                new THREE.Color(1, 0.6, 0.2)
            );
        }
    }

    /** 每帧调用 */
    update(dt) {
        this.muzzleFlash.update(dt);
        this.shellCasing.update(dt);
        this.impactSpark.update(dt);
        this.muzzleSmoke.update(dt);
        this.bulletHole.update();
        this.tracer.update();
        // 注意: screenShake.update() 需要在 camera.position 设置好之后调用
        // 建议在外部每帧设置 camera 位置后调用 screenShake.update(dt)
    }

    /** 清理所有特效 */
    clear() {
        this.muzzleFlash.clear();
        this.shellCasing.clear();
        this.impactSpark.clear();
        this.muzzleSmoke.clear();
        this.bulletHole.clear();
        this.tracer.clear();
        this.screenShake.clear();
    }
}
