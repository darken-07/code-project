// ============================================================
// player.js - 第三人称玩家控制：移动、视角、角色模型
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
        this.position = new THREE.Vector3(0, 0, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.yaw = 0;
        this.pitch = 0.35; // 默认俯角15度看向角色

        // 状态
        this.isGrounded = false;
        this.isRunning = false;
        this.health = 100;
        this.maxHealth = 100;

        // 武器
        this.weapons = [
            { name: '\u{1F52B} 手枪', ammo: 12, maxAmmo: 12, reserve: 48, damage: 20, fireRate: 400, reloadTime: 1000, auto: false },
            { name: '\u{1F52B} 冲锋枪', ammo: 30, maxAmmo: 30, reserve: 150, damage: 12, fireRate: 100, reloadTime: 1500, auto: true },
        ];
        this.currentWeapon = 0;
        this.lastFireTime = 0;
        this.isReloading = false;
        this.reloadStartTime = 0;
        this.autoFire = true;

        // 拾取半径
        this.pickupRadius = 1.5;

        // 伤害免疫计时
        this.invincibleUntil = 0;

        // 速度参数
        this.walkSpeed = 8;
        this.runSpeed = 14;
        this.jumpPower = 7;
        this.gravity = -25;

        // 武器后坐力
        this.recoilAmount = 0;

        // 模型参数
        this.playerHeight = 1.8;
        this.playerRadius = 0.4;

        // 相机参数（第三人称）——调远一点让准星不跟人物重叠
        this.camDistance = 8;
        this.camHeight = 3.5;
        this.camSmoothSpeed = 5;

        // 构建玩家模型
        this.group = this.buildPlayerModel();
        this.group.position.copy(this.position);
        this.scene.add(this.group);

        // 走路摆动
        this.walkTime = 0;
        this.walkBob = 0;
        this.weaponBobOffset = { x: 0, y: 0 };

        // 构建枪械模型（附加到玩家手上）
        this.gunModel = this.buildGunModel();
        this.group.add(this.gunModel);

        // 枪口位置（射击原点）
        this.muzzleWorldPos = new THREE.Vector3();
    }

    // ===== 构建玩家模型 =====

    buildPlayerModel() {
        const group = new THREE.Group();

        // ---- 身体 ----
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x4488cc,
            roughness: 0.7,
            metalness: 0.2,
        });
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(0.7, 0.8, 0.4),
            bodyMat
        );
        body.position.y = 1.2;
        body.castShadow = true;
        group.add(body);
        this.bodyMesh = body;

        // ---- 头部 ----
        const headMat = new THREE.MeshStandardMaterial({
            color: 0xffccaa,
            roughness: 0.6,
        });
        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.22, 8, 8),
            headMat
        );
        head.position.y = 1.75;
        head.castShadow = true;
        group.add(head);
        this.headMesh = head;

        // ---- 眼睛 ----
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
        for (const side of [-1, 1]) {
            const eye = new THREE.Mesh(
                new THREE.SphereGeometry(0.04, 6, 6),
                eyeMat
            );
            eye.position.set(side * 0.12, 1.78, -0.2);
            group.add(eye);
        }

        // ---- 左臂 ----
        const armMat = new THREE.MeshStandardMaterial({
            color: 0xffccaa,
            roughness: 0.7,
        });
        this.leftArm = new THREE.Mesh(
            new THREE.BoxGeometry(0.15, 0.55, 0.15),
            armMat
        );
        this.leftArm.position.set(-0.5, 1.15, 0);
        group.add(this.leftArm);

        // ---- 右臂（持枪臂） ----
        this.rightArm = new THREE.Mesh(
            new THREE.BoxGeometry(0.15, 0.55, 0.15),
            armMat
        );
        this.rightArm.position.set(0.5, 1.15, 0);
        group.add(this.rightArm);

        // ---- 左腿 ----
        const legMat = new THREE.MeshStandardMaterial({
            color: 0x334466,
            roughness: 0.8,
        });
        this.leftLeg = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 0.55, 0.2),
            legMat
        );
        this.leftLeg.position.set(-0.2, 0.27, 0);
        group.add(this.leftLeg);

        // ---- 右腿 ----
        this.rightLeg = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 0.55, 0.2),
            legMat
        );
        this.rightLeg.position.set(0.2, 0.27, 0);
        group.add(this.rightLeg);

        // 初始默认右臂指向正前方（持枪姿势）
        this.rightArm.rotation.x = -0.6;
        this.rightArm.position.z = -0.15;
        this.rightArm.position.x = 0.55;
        this.rightArm.position.y = 1.2;

        return group;
    }

    // ===== 构建枪械模型 =====

    buildGunModel() {
        const gunGroup = new THREE.Group();

        // 根据当前武器选择外观
        this.updateGunAppearance(gunGroup);

        return gunGroup;
    }

    updateGunAppearance(gunGroup) {
        // 清除旧的枪械子物体
        while (gunGroup.children.length > 0) {
            const child = gunGroup.children[0];
            gunGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        }

        const isPistol = this.currentWeapon === 0;

        if (isPistol) {
            // ---- 手枪 ----
            const metalMat = new THREE.MeshStandardMaterial({
                color: 0x444466,
                roughness: 0.3,
                metalness: 0.8,
            });
            const darkMat = new THREE.MeshStandardMaterial({
                color: 0x222233,
                roughness: 0.5,
                metalness: 0.6,
            });

            // 枪身
            const body = new THREE.Mesh(
                new THREE.BoxGeometry(0.08, 0.12, 0.35),
                metalMat
            );
            body.position.set(0, -0.05, -0.25);
            gunGroup.add(body);

            // 枪管
            const barrel = new THREE.Mesh(
                new THREE.CylinderGeometry(0.025, 0.03, 0.2, 6),
                darkMat
            );
            barrel.rotation.x = Math.PI / 2;
            barrel.position.set(0, 0, -0.45);
            gunGroup.add(barrel);

            // 握把
            const grip = new THREE.Mesh(
                new THREE.BoxGeometry(0.06, 0.12, 0.1),
                darkMat
            );
            grip.position.set(0, -0.1, 0.1);
            grip.rotation.x = 0.2;
            gunGroup.add(grip);

            // 扳机护圈
            const trigger = new THREE.Mesh(
                new THREE.TorusGeometry(0.03, 0.008, 4, 8, Math.PI),
                metalMat
            );
            trigger.position.set(0, -0.02, 0.05);
            trigger.rotation.x = Math.PI / 2;
            gunGroup.add(trigger);

            // 枪口位置标记
            this.muzzleOffset = new THREE.Vector3(0, 0, -0.5);
        } else {
            // ---- 冲锋枪 ----
            const metalMat = new THREE.MeshStandardMaterial({
                color: 0x555577,
                roughness: 0.3,
                metalness: 0.7,
            });
            const darkMat = new THREE.MeshStandardMaterial({
                color: 0x222233,
                roughness: 0.5,
                metalness: 0.5,
            });

            // 机匣
            const receiver = new THREE.Mesh(
                new THREE.BoxGeometry(0.08, 0.1, 0.45),
                metalMat
            );
            receiver.position.set(0, 0, -0.3);
            gunGroup.add(receiver);

            // 枪管（较长）
            const barrel = new THREE.Mesh(
                new THREE.CylinderGeometry(0.02, 0.025, 0.35, 6),
                darkMat
            );
            barrel.rotation.x = Math.PI / 2;
            barrel.position.set(0, 0, -0.6);
            gunGroup.add(barrel);

            // 弹匣
            const mag = new THREE.Mesh(
                new THREE.BoxGeometry(0.06, 0.15, 0.08),
                darkMat
            );
            mag.position.set(0, -0.12, -0.2);
            mag.rotation.x = 0.15;
            gunGroup.add(mag);

            // 前握把
            const foregrip = new THREE.Mesh(
                new THREE.BoxGeometry(0.04, 0.08, 0.04),
                darkMat
            );
            foregrip.position.set(0, -0.1, -0.4);
            gunGroup.add(foregrip);

            // 消音器/枪口装置
            const muzzleBrake = new THREE.Mesh(
                new THREE.CylinderGeometry(0.03, 0.035, 0.06, 6),
                darkMat
            );
            muzzleBrake.rotation.x = Math.PI / 2;
            muzzleBrake.position.set(0, 0, -0.78);
            gunGroup.add(muzzleBrake);

            // 枪口位置标记
            this.muzzleOffset = new THREE.Vector3(0, 0, -0.8);
        }

        // 枪械在右手的位置偏移（让枪在角色手上更明显）
        gunGroup.position.set(0.4, 0.55, -0.35);
        // 倾斜展示（枪口朝前略向下）
        gunGroup.rotation.x = -0.25;
        gunGroup.rotation.z = 0.2;

        this.gunModelOffset = gunGroup.position.clone();
    }

    get weapon() {
        return this.weapons[this.currentWeapon];
    }

    update(dt) {
        // ---- 鼠标控制视角 ----
        const { dx, dy } = getMouseDelta();
        const sensitivity = 0.008; // 提高灵敏度

        // 水平旋转玩家朝向（yaw）- 左右转
        this.yaw -= dx * sensitivity;

        // 垂直倾斜相机（pitch），只控制相机俯仰，范围放更大
        this.pitch -= dy * sensitivity * 0.6;
        this.pitch = Math.max(0.05, Math.min(Math.PI / 2.5, this.pitch));

        // ---- 移动 ----
        this.isRunning = !!keys['ShiftLeft'] || !!keys['ShiftRight'];
        const speed = this.isRunning ? this.runSpeed : this.walkSpeed;

        // 相对于玩家朝向的移动方向
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

        const isMoving = moveDir.length() > 0;
        if (isMoving) {
            moveDir.normalize();
        }

        // 跳跃
        if ((keys['Space'] || keys['Key ']) && this.isGrounded) {
            this.velocity.y = this.jumpPower;
            this.isGrounded = false;
        }

        // ---- 应用物理 ----
        const moveX = moveDir.x * speed * dt;
        const moveZ = moveDir.z * speed * dt;

        const newPos = this.position.clone();
        newPos.x += moveX;
        newPos.z += moveZ;

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
        if (this.position.y <= 0) {
            this.position.y = 0;
            this.velocity.y = 0;
            this.isGrounded = true;
        }

        // 边界限制
        const boundary = 140;
        this.position.x = Math.max(-boundary, Math.min(boundary, this.position.x));
        this.position.z = Math.max(-boundary, Math.min(boundary, this.position.z));

        // ---- 更新玩家模型位置与旋转 ----
        this.group.position.copy(this.position);
        // 玩家模型朝向 = yaw（水平旋转）
        this.group.rotation.y = this.yaw;

        // ---- 走路摆动 ----
        if (isMoving && this.isGrounded) {
            this.walkTime += dt * (this.isRunning ? 12 : 8);
            this.walkBob = Math.sin(this.walkTime) * 0.04;

            // 腿交替摆动
            const legSwing = Math.sin(this.walkTime) * 0.3;
            this.leftLeg.rotation.x = legSwing;
            this.rightLeg.rotation.x = -legSwing;

            // 身体轻微左右晃动
            this.bodyMesh.position.x = Math.sin(this.walkTime * 0.5) * 0.015;
            this.headMesh.position.x = Math.sin(this.walkTime * 0.5 + 0.5) * 0.01;

            // 持枪手摆动
            this.weaponBobOffset.x = Math.sin(this.walkTime * 1.2) * 0.02;
            this.weaponBobOffset.y = Math.abs(Math.cos(this.walkTime * 0.8)) * 0.02;
        } else {
            this.walkBob *= 0.9;
            this.leftLeg.rotation.x *= 0.9;
            this.rightLeg.rotation.x *= 0.9;
            this.bodyMesh.position.x *= 0.9;
            this.headMesh.position.x *= 0.9;
            this.weaponBobOffset.x *= 0.9;
            this.weaponBobOffset.y *= 0.9;
        }

        // 身体上下浮动
        this.group.position.y += this.walkBob;

        // ---- 更新持枪手臂指向鼠标方向 ----
        this.updateArms(dt);

        // ---- 更新枪械模型（武器切换时） ----
        // 应用走路摆动到枪械
        this.gunModel.position.x = this.gunModelOffset.x + this.weaponBobOffset.x;
        this.gunModel.position.y = this.gunModelOffset.y + this.weaponBobOffset.y;

        // ---- 第三人称相机 ----
        this.updateCamera(dt);

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

    updateArms(dt) {
        // 右臂：持枪臂，指向角色前方（根据pitch略微调整）
        const pitchFactor = Math.min(this.pitch / (Math.PI / 2.5), 1);
        const targetArmX = -0.6 - pitchFactor * 0.3;
        this.rightArm.rotation.x += (targetArmX - this.rightArm.rotation.x) * dt * 10;
        this.rightArm.position.z = -0.15 - pitchFactor * 0.1;

        // 左臂：自然摆动
        const leftArmSwing = Math.sin(this.walkTime * 0.8) * 0.15;
        this.leftArm.rotation.x += (0.2 + leftArmSwing - this.leftArm.rotation.x) * dt * 10;
    }

    updateCamera(dt) {
        // 根据玩家的 yaw 和 pitch 计算相机位置
        // 相机在玩家后方：水平方向沿玩家朝向的反方向，垂直方向根据pitch
        const camHorizAngle = this.yaw;
        const camVertAngle = this.pitch;

        // 计算理想相机位置
        const idealOffset = new THREE.Vector3(
            Math.sin(camHorizAngle) * this.camDistance * Math.cos(camVertAngle),
            this.camHeight + Math.sin(camVertAngle) * this.camDistance * 0.4,
            Math.cos(camHorizAngle) * this.camDistance * Math.cos(camVertAngle)
        );

        const idealPos = this.position.clone().add(idealOffset);
        idealPos.y = Math.max(0.5, idealPos.y); // 防止相机穿地

        // 平滑移动到理想位置
        this.camera.position.lerp(idealPos, Math.min(1, this.camSmoothSpeed * dt));

        // 相机看向玩家（稍微向上偏移使玩家在画面下方）
        const lookTarget = this.position.clone();
        lookTarget.y += 1.2;
        this.camera.lookAt(lookTarget);
    }

    checkCollision(x, z) {
        const r = this.playerRadius;
        for (const building of this.buildings) {
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
        this.invincibleUntil = now + 200;
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

    fire(aimDir) {
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

        // 从枪口位置发射子弹
        const gunPos = this.getGunPosition();

        // 射击方向：如果传入了aimDir就用它（屏幕准星方向），否则用角色朝向
        let dir;
        if (aimDir) {
            dir = aimDir.clone();
            // 加一点散射
            const spread = 0.01;
            dir.x += (Math.random() - 0.5) * spread;
            dir.y += (Math.random() - 0.5) * spread;
            dir.z += (Math.random() - 0.5) * spread;
            dir.normalize();
        } else {
            const spread = 0.015;
            dir = new THREE.Vector3(0, 0, -1);
            const euler = new THREE.Euler(
                this.pitch + (Math.random() - 0.5) * spread,
                this.yaw + (Math.random() - 0.5) * spread,
                0, 'YXZ'
            );
            dir.applyEuler(euler);
        }

        return {
            origin: gunPos,
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
        // 更新枪械外观
        this.updateGunAppearance(this.gunModel);
    }

    toggleFireMode() {
        this.autoFire = !this.autoFire;
    }

    // ---- 拾取弹药 ----
    addAmmo(weaponIdx, amount) {
        if (weaponIdx < 0 || weaponIdx >= this.weapons.length) return;
        this.weapons[weaponIdx].reserve += amount;
    }

    // ---- 公用方法 ----

    /** 获取枪口世界坐标（用于子弹发射、特效） */
    getGunPosition() {
        // 枪口位置：玩家位置 + 右臂偏移 + 枪械偏移
        const localOffset = new THREE.Vector3(
            0.4 + this.weaponBobOffset.x,
            1.1 + this.weaponBobOffset.y,
            -0.6
        );
        // 应用玩家朝向的旋转
        const worldOffset = localOffset.clone().applyQuaternion(
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.yaw, 0))
        );
        const pos = this.position.clone().add(worldOffset);
        // 加上走路浮动
        pos.y += this.walkBob + 0.2;
        return pos;
    }

    /** 获取玩家面朝方向（水平方向归一化向量） */
    getForward() {
        return new THREE.Vector3(0, 0, -1).applyQuaternion(
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.yaw, 0))
        );
    }
}
