// ============================================================
// game.js - 游戏主逻辑：物品、波次、特效
// ============================================================
import * as THREE from 'three';

// ===== 子弹特效 =====
export class BulletEffects {
    constructor(scene) {
        this.scene = scene;
        this.bulletHoles = [];
        this.muzzleFlashes = [];
        this.tracers = [];
    }

    addTracer(origin, direction, length = 20) {
        const end = origin.clone().add(direction.clone().multiplyScalar(length));
        const mid = origin.clone().add(direction.clone().multiplyScalar(length * 0.5));

        const geo = new THREE.BufferGeometry().setFromPoints([origin, end]);
        const mat = new THREE.LineBasicMaterial({
            color: 0xffff88,
            transparent: true,
            opacity: 0.6,
        });
        const line = new THREE.Line(geo, mat);
        this.scene.add(line);
        this.tracers.push({ mesh: line, time: performance.now() });

        // 限制tracer数量
        if (this.tracers.length > 20) {
            const old = this.tracers.shift();
            this.scene.remove(old.mesh);
        }
    }

    addMuzzleFlash(position) {
        const flash = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 4, 4),
            new THREE.MeshBasicMaterial({ color: 0xffffaa })
        );
        flash.position.copy(position);
        this.scene.add(flash);
        this.muzzleFlashes.push({ mesh: flash, time: performance.now() });
    }

    addBulletImpact(position, normal) {
        // Impact sprite
        const impact = new THREE.Mesh(
            new THREE.SphereGeometry(0.05, 4, 4),
            new THREE.MeshBasicMaterial({ color: 0xffff00 })
        );
        impact.position.copy(position);
        this.scene.add(impact);
        this.bulletHoles.push({ mesh: impact, time: performance.now() });
    }

    update() {
        const now = performance.now();

        // 清理tracers
        for (let i = this.tracers.length - 1; i >= 0; i--) {
            if (now - this.tracers[i].time > 80) {
                this.scene.remove(this.tracers[i].mesh);
                this.tracers.splice(i, 1);
            }
        }

        // 清理muzzle flashes
        for (let i = this.muzzleFlashes.length - 1; i >= 0; i--) {
            if (now - this.muzzleFlashes[i].time > 50) {
                this.scene.remove(this.muzzleFlashes[i].mesh);
                this.muzzleFlashes.splice(i, 1);
            }
        }

        // 清理bullet holes
        for (let i = this.bulletHoles.length - 1; i >= 0; i--) {
            if (now - this.bulletHoles[i].time > 2000) {
                this.scene.remove(this.bulletHoles[i].mesh);
                this.bulletHoles.splice(i, 1);
            }
        }
    }
}

// ===== 拾取物品系统 =====
export class PickupManager {
    constructor(scene) {
        this.scene = scene;
        this.pickups = [];
        this.lastSpawn = 0;
        this.interval = 8000; // 每8秒尝试生成
        this.maxPickups = 8;
    }

    update(player) {
        const now = performance.now();

        // 生成新拾取物
        if (this.pickups.length < this.maxPickups && now - this.lastSpawn > this.interval) {
            this.spawnPickup(player);
            this.lastSpawn = now;
        }

        // 检查玩家拾取
        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const p = this.pickups[i];
            // 旋转动画
            p.mesh.rotation.y += 0.03;
            p.mesh.position.y = p.baseY + Math.sin(now * 0.002 + i) * 0.2;

            const dist = p.mesh.position.distanceTo(player.position);
            if (dist < 2) {
                // 拾取！
                this.collect(p, player);
                this.scene.remove(p.mesh);
                this.pickups.splice(i, 1);
            }
        }
    }

    spawnPickup(player) {
        const types = ['health', 'ammo_pistol', 'ammo_smg'];
        const type = types[Math.floor(Math.random() * types.length)];

        // 在玩家附近生成（但不要太近）
        const angle = Math.random() * Math.PI * 2;
        const dist = 10 + Math.random() * 20;
        const pos = new THREE.Vector3(
            player.position.x + Math.cos(angle) * dist,
            0.5,
            player.position.z + Math.sin(angle) * dist
        );

        // 不要卡在建筑里
        if (player.checkCollision(pos.x, pos.z)) return;

        let mesh, color;
        switch (type) {
            case 'health':
                color = 0x44ff44;
                mesh = new THREE.Mesh(
                    new THREE.BoxGeometry(0.6, 0.6, 0.6),
                    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3 })
                );
                break;
            case 'ammo_pistol':
            case 'ammo_smg':
                color = 0xffaa44;
                mesh = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.3, 0.3, 0.5, 8),
                    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3 })
                );
                break;
        }

        mesh.position.copy(pos);
        mesh.castShadow = true;
        this.scene.add(mesh);

        // Glow ring
        const ringMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide,
        });
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.7, 16), ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.copy(pos);
        ring.position.y = 0.05;
        this.scene.add(ring);

        this.pickups.push({
            mesh,
            ring,
            type,
            baseY: pos.y,
            value: type === 'health' ? 25 : 20,
            weaponIdx: type === 'ammo_pistol' ? 0 : 1,
        });
    }

    collect(pickup, player) {
        const notice = document.getElementById('pickup-notice');
        if (!notice) return;

        let msg = '';
        switch (pickup.type) {
            case 'health':
                player.heal(pickup.value);
                msg = `❤️ +${pickup.value} 生命值`;
                break;
            case 'ammo_pistol':
                player.addAmmo(0, pickup.value);
                msg = `🔫 +${pickup.value} 手枪弹药`;
                break;
            case 'ammo_smg':
                player.addAmmo(1, pickup.value);
                msg = `🔫 +${pickup.value} 冲锋枪弹药`;
                break;
        }

        notice.textContent = msg;
        notice.style.display = 'block';

        // 移除ring
        this.scene.remove(pickup.ring);

        // 动画效果
        notice.style.animation = 'none';
        void notice.offsetHeight; // restart animation
        notice.style.animation = 'fadeUp 1.5s ease-out forwards';
        setTimeout(() => { notice.style.display = 'none'; }, 1500);
    }

    clear() {
        for (const p of this.pickups) {
            this.scene.remove(p.mesh);
            this.scene.remove(p.ring);
        }
        this.pickups = [];
    }
}
