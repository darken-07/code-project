// ============================================================
// player.js - 玩家控制：移动、跳跃、碰撞
// ============================================================
import * as THREE from 'three';

const keys = {};
let mouseX = 0, mouseY = 0;
let isPointerLocked = false;

export function initControls() {
    document.addEventListener('keydown', e => { keys[e.code] = true; });
    document.addEventListener('keyup', e => { keys[e.code] = false; });
    document.addEventListener('mousemove', e => {
        mouseX += e.movementX || 0;
        mouseY += e.movementY || 0;
    });
    document.addEventListener('pointerlockchange', () => {
        isPointerLocked = document.pointerLockElement !== null;
    });
}

export function requestPointerLock() {
    document.body.requestPointerLock();
}

export function isLocked() {
    return isPointerLocked;
}

export function isKeyDown(code) {
    return !!keys[code];
}

export function getMouseDelta() {
    const dx = mouseX;
    const dy = mouseY;
    mouseX = 0;
    mouseY = 0;
    return { dx, dy };
}

// ===== 玩家类 =====
export class Player {
    constructor(camera, scene, buildings) {
        this.camera = camera;
        this.scene = scene;
        this.buildings = buildings;

        // 位置
        this.position = new THREE.Vector3(0, 1.6, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.yaw = 0;
        this.pitch = 0;

        // 状态
        this.isGrounded = false;
        this.isRunning = false;
        this.health = 100;
        this.maxHealth = 100;

        // 武器
        this.weapons = [
            { name: '🔫 手枪', ammo: 12, maxAmmo: 12, reserve: 48, damage: 20, fireRate: 400, reloadTime: 1000, auto: false },
            { name: '🔫 冲锋枪', ammo: 30, maxAmmo: 30, reserve: 150, damage: 12, fireRate: 100, reloadTime: 1500, auto: true },
        ];
        this.currentWeapon = 0;
        this.lastFireTime = 0;
        this.isReloading = false;
        this.reloadStartTime = 0;
        this.autoFire = true; // true=按住连发, false=单发

        // 拾取框（用于拾取物检测）
        this.pickupRadius = 1.5;

        // 伤害免疫计时
        this.invincibleUntil = 0;

        // 实际速度参数
        this.walkSpeed = 8;
        this.runSpeed = 14;
        this.jumpPower = 7;
        this.gravity = -25;

        // 武器后坐力
        this.recoilAmount = 0;
    }

    get weapon() {
        return this.weapons[this.currentWeapon];
    }

    update(dt) {
        // ---- 鼠标视角 ----
        const { dx, dy } = getMouseDelta();
        const sensitivity = 0.002;
        this.yaw -= dx * sensitivity;
        this.pitch -= dy * sensitivity;
        this.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.pitch));

        // 更新相机旋转
        const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
        this.camera.quaternion.setFromEuler(euler);

        // ---- 移动 ----
        this.isRunning = !!keys['ShiftLeft'] || !!keys['ShiftRight'];
        const speed = this.isRunning ? this.runSpeed : this.walkSpeed;

        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.yaw, 0))
        );
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.yaw, 0))
        );

        const moveDir = new THREE.Vector3(0, 0, 0);
        if (keys['KeyW']) moveDir.add(forward);
        if (keys['KeyS']) moveDir.sub(forward);
        if (keys['KeyA']) moveDir.sub(right);
        if (keys['KeyD']) moveDir.add(right);

        if (moveDir.length() > 0) {
            moveDir.normalize();
            // 奔跑视野缩放效果（通过修改FOV实现）
            const targetFov = this.isRunning ? 75 : 70;
            this.camera.fov += (targetFov - this.camera.fov) * dt * 8;
            this.camera.updateProjectionMatrix();
        } else {
            this.camera.fov += (70 - this.camera.fov) * dt * 8;
            this.camera.updateProjectionMatrix();
        }

        // 跳跃
        if ((keys['Space'] || keys['Key ']) && this.isGrounded) {
            this.velocity.y = this.jumpPower;
            this.isGrounded = false;
        }

        // ---- 应用物理 ----
        // 水平移动（碰撞检测）
        const moveX = moveDir.x * speed * dt;
        const moveZ = moveDir.z * speed * dt;

        // 水平碰撞检测
        const newPos = this.position.clone();
        newPos.x += moveX;
        newPos.z += moveZ;

        const playerRadius = 0.4;
        const playerHeight = 1.6;
        if (!this.checkCollision(newPos.x, this.position.z)) {
            this.position.x = newPos.x;
        }
        if (!this.checkCollision(this.position.x, newPos.z)) {
            this.position.z = newPos.z;
        }

        // 重力
        this.velocity.y += this.gravity * dt;
        this.position.y += this.velocity.y * dt;

        // 地面碰撞
        if (this.position.y <= 1.6) {
            this.position.y = 1.6;
            this.velocity.y = 0;
            this.isGrounded = true;
        }

        // 边界限制
        const boundary = 140;
        this.position.x = Math.max(-boundary, Math.min(boundary, this.position.x));
        this.position.z = Math.max(-boundary, Math.min(boundary, this.position.z));

        // 更新相机位置
        this.camera.position.copy(this.position);

        // ---- 武器后坐力恢复 ----
        if (this.recoilAmount > 0) {
            const recoilRecovery = 0.5;
            this.pitch += this.recoilAmount * recoilRecovery * dt * 10;
            this.recoilAmount *= (1 - recoilRecovery * dt * 10);
            if (this.recoilAmount < 0.001) this.recoilAmount = 0;
        }

        // ---- 换弹计时 ----
        if (this.isReloading) {
            if (performance.now() - this.reloadStartTime >= this.weapon.reloadTime) {
                this.finishReload();
            }
        }
    }

    checkCollision(x, z) {
        const r = 0.4;
        for (const building of this.buildings) {
            // 获取建筑边界（近似：每个建筑物group的第一个mesh是主体）
            const mesh = building.children[0];
            if (!mesh || !mesh.geometry) continue;
            const halfW = mesh.geometry.parameters.width / 2;
            const halfD = mesh.geometry.parameters.depth / 2;
            const bx = mesh.position.x;
            const bz = mesh.position.z;

            if (x + r > bx - halfW && x - r < bx + halfW &&
                z + r > bz - halfD && z - r < bz + halfD) {
                return true;
            }
        }
        return false;
    }

    takeDamage(amount) {
        const now = performance.now();
        if (now < this.invincibleUntil) return false;

        this.health -= amount;
        this.invincibleUntil = now + 200; // 0.2秒无敌
        return true;
    }

    heal(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
    }

    // ---- 射击 ----
    canFire() {
        const now = performance.now();
        if (this.isReloading) return false;
        if (this.weapon.ammo <= 0) {
            this.startReload();
            return false;
        }
        if (now - this.lastFireTime < this.weapon.fireRate) return false;
        return true;
    }

    fire() {
        if (!this.canFire()) return null;
        this.lastFireTime = performance.now();
        this.weapon.ammo--;

        // 后坐力
        const recoil = 0.01 + Math.random() * 0.015;
        this.pitch += recoil;
        this.recoilAmount += recoil;

        if (this.weapon.ammo <= 0) {
            this.startReload();
        }

        // 计算子弹方向（带散射）
        const spread = 0.01;
        const dir = new THREE.Vector3(0, 0, -1);
        const euler = new THREE.Euler(
            this.pitch + (Math.random() - 0.5) * spread,
            this.yaw + (Math.random() - 0.5) * spread,
            0, 'YXZ'
        );
        dir.applyEuler(euler);

        return {
            origin: this.position.clone().add(new THREE.Vector3(0, 1.5, 0)),
            direction: dir,
            damage: this.weapon.damage,
        };
    }

    startReload() {
        if (this.isReloading) return;
        if (this.weapon.reserve <= 0 || this.weapon.ammo === this.weapon.maxAmmo) return;
        this.isReloading = true;
        this.reloadStartTime = performance.now();
    }

    finishReload() {
        const need = this.weapon.maxAmmo - this.weapon.ammo;
        const give = Math.min(need, this.weapon.reserve);
        this.weapon.ammo += give;
        this.weapon.reserve -= give;
        this.isReloading = false;
    }

    switchWeapon(index) {
        if (index < 0 || index >= this.weapons.length) return;
        if (this.currentWeapon === index) return;
        this.currentWeapon = index;
        this.isReloading = false;
    }

    toggleFireMode() {
        this.autoFire = !this.autoFire;
    }

    // ---- 拾取弹药 ----
    addAmmo(weaponIdx, amount) {
        if (weaponIdx < 0 || weaponIdx >= this.weapons.length) return;
        this.weapons[weaponIdx].reserve += amount;
    }
}
