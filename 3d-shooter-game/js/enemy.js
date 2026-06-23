// ============================================================
// enemy.js - 敌人AI、生成系统、子弹
// ============================================================
import * as THREE from 'three';

const ENEMY_TYPES = {
    grunt:   { health: 50,  speed: 3 + Math.random()*1.5, dmg: 8,  range: 2,  rate: 1000, score: 100, color: 0xff4444, size: 0.6 },
    runner:  { health: 30,  speed: 6 + Math.random()*2,   dmg: 12, range: 1.5,rate: 800,  score: 150, color: 0xff8800, size: 0.5 },
    tank:    { health: 150, speed: 1.5+Math.random()*0.5, dmg: 15, range: 2.5,rate: 1500, score: 300, color: 0xaa0000, size: 0.9 },
    shooter: { health: 40,  speed: 2 + Math.random()*1,   dmg: 10, range: 30, rate: 1500, score: 200, color: 0xff00ff, size: 0.55 },
};

export class EnemyManager {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        this.enemies = [];
        this.bullets = [];
        this.wave = 0;
        this.spawned = 0;
        this.maxSpawn = 0;
        this.active = false;
        this.lastSpawn = 0;
        this.delay = 500;
        this.radius = 40;
        this.minDist = 15;
        this.cap = 20;
    }

    startWave(wave) {
        this.wave = wave;
        this.active = true;
        this.spawned = 0;
        this.maxSpawn = 3 + wave * 2;
        this.delay = Math.max(150, 500 - wave * 25);
        this.lastSpawn = performance.now();
        return this.maxSpawn;
    }

    update(dt) {
        const now = performance.now();

        // spawn
        if (this.active && this.spawned < this.maxSpawn && this.enemies.length < this.cap) {
            if (now - this.lastSpawn > this.delay) {
                this.spawn();
                this.spawned++;
                this.lastSpawn = now;
            }
        }

        // wave done?
        if (this.active && this.spawned >= this.maxSpawn && this.enemies.length === 0) {
            this.active = false;
            return true;
        }

        // update enemies
        for (const e of this.enemies) e.update(dt, this.player);

        // update bullets
        for (const b of this.bullets) {
            b.pos.add(b.dir.clone().multiplyScalar(b.speed * dt));
            if (b.mesh) b.mesh.position.copy(b.pos);
            // hit player?
            if (b.pos.distanceTo(this.player.position) < 0.7) {
                this.player.takeDamage(b.dmg);
                b.alive = false;
                document.getElementById('damage-overlay')?.classList.add('hit');
                setTimeout(() => document.getElementById('damage-overlay')?.classList.remove('hit'), 100);
            }
            // out of range
            if (b.pos.distanceTo(b.origin) > 50) b.alive = false;
        }

        // clean
        this.enemies = this.enemies.filter(e => e.alive);
        for (const b of this.bullets) {
            if (!b.alive && b.mesh) this.scene.remove(b.mesh);
        }
        this.bullets = this.bullets.filter(b => b.alive);
    }

    spawn() {
        let type = 'grunt';
        const r = Math.random();
        if (this.wave >= 2 && r < 0.15) type = 'tank';
        else if (this.wave >= 1 && r < 0.25) type = 'shooter';
        else if (this.wave >= 1 && r < 0.4) type = 'runner';
        const cfg = ENEMY_TYPES[type];

        // pick position beyond visible range
        let pos;
        for (let i = 0; i < 30; i++) {
            const a = Math.random() * Math.PI * 2;
            const d = this.radius + Math.random() * 15;
            pos = new THREE.Vector3(
                this.player.position.x + Math.cos(a) * d,
                0.5,
                this.player.position.z + Math.sin(a) * d
            );
            if (pos.distanceTo(this.player.position) >= this.minDist) break;
        }

        const enemy = new Enemy(pos, cfg, this.scene, this.bullets);
        this.enemies.push(enemy);
        this.scene.add(enemy.group);
    }

    // raycast against all alive enemies
    hitTest(origin, dir) {
        const ray = new THREE.Raycaster(origin, dir, 0, 100);
        let best = null, bestDist = Infinity;
        for (const e of this.enemies) {
            if (!e.alive) continue;
            const box = new THREE.Box3().setFromObject(e.group);
            const hit = ray.ray.intersectBox(box, new THREE.Vector3());
            if (hit) {
                const d = origin.distanceTo(hit);
                if (d < bestDist) { bestDist = d; best = e; }
            }
        }
        return best;
    }

    clear() {
        for (const e of this.enemies) { this.scene.remove(e.group); }
        for (const b of this.bullets) { if (b.mesh) this.scene.remove(b.mesh); }
        this.enemies = [];
        this.bullets = [];
    }
}

// ===== 单个敌人 =====
class Enemy {
    constructor(pos, cfg, scene, bullets) {
        this.cfg = cfg;
        this.pos = pos.clone();
        this.hp = cfg.health;
        this.maxHp = cfg.health;
        this.alive = true;
        this.lastAtk = 0;
        this.offset = Math.random() * 1000;
        this.scene = scene;
        this.bullets = bullets;
        this.group = this.buildMesh();
        this.group.position.copy(pos);
    }

    buildMesh() {
        const g = new THREE.Group();
        const s = this.cfg.size;

        const bodyMat = new THREE.MeshStandardMaterial({ color: this.cfg.color, roughness: 0.7, metalness: 0.3 });
        const body = new THREE.Mesh(new THREE.BoxGeometry(s, s*1.2, s), bodyMat);
        body.position.y = s*0.6;
        body.castShadow = true;
        g.add(body);

        const headMat = new THREE.MeshStandardMaterial({ color: 0xffaaaa, roughness: 0.6 });
        const head = new THREE.Mesh(new THREE.SphereGeometry(s*0.4, 6, 6), headMat);
        head.position.y = s*1.4;
        head.castShadow = true;
        g.add(head);

        // eyes
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.5 });
        for (const side of [-1, 1]) {
            const e = new THREE.Mesh(new THREE.SphereGeometry(s*0.1), eyeMat);
            e.position.set(side*s*0.3, s*1.45, -s*0.35);
            g.add(e);
        }

        // arms
        const armMat = new THREE.MeshStandardMaterial({ color: this.cfg.color });
        for (const side of [-1, 1]) {
            const a = new THREE.Mesh(new THREE.BoxGeometry(s*0.15, s*0.7, s*0.15), armMat);
            a.position.set(side*s*0.7, s*0.65, 0);
            g.add(a);
        }

        // health bar
        const hb = this.makeHealthBar();
        hb.position.y = s*2;
        g.add(hb);

        this.bodyMat = bodyMat;
        this.headMat = headMat;
        this.healthBar = hb;
        return g;
    }

    makeHealthBar() {
        const c = document.createElement('canvas');
        c.width = 64; c.height = 8;
        const tex = new THREE.CanvasTexture(c);
        const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
        const sp = new THREE.Sprite(mat);
        sp.scale.set(1, 0.15, 1);
        sp.userData.ctx = c.getContext('2d');
        sp.userData.canvas = c;
        sp.userData.texture = tex;
        return sp;
    }

    drawHealthBar() {
        const ctx = this.healthBar.userData.ctx;
        const c = this.healthBar.userData.canvas;
        const tex = this.healthBar.userData.texture;
        ctx.clearRect(0, 0, 64, 8);
        ctx.fillStyle = '#333';
        ctx.fillRect(0, 0, 64, 8);
        const r = this.hp / this.maxHp;
        ctx.fillStyle = r > 0.5 ? '#4f4' : r > 0.25 ? '#ff0' : '#f44';
        ctx.fillRect(2, 1, Math.max(0, 60 * r), 6);
        tex.needsUpdate = true;
    }

    takeDamage(amount) {
        if (!this.alive) return false;
        this.hp -= amount;
        // flash white
        this.bodyMat.color.setHex(0xffffff);
        this.headMat.color.setHex(0xffffff);
        setTimeout(() => {
            if (this.alive) {
                this.bodyMat.color.setHex(this.cfg.color);
                this.headMat.color.setHex(0xffaaaa);
            }
        }, 60);
        this.drawHealthBar();
        if (this.hp <= 0) return this.die(), true;
        return false;
    }

    die() {
        this.alive = false;
        this.group.position.y = -0.5;
        this.group.rotation.x = Math.random() * 0.5;
        this.group.rotation.z = Math.random() * 0.5;
        this.bodyMat.color.setHex(0x440000);
        this.headMat.color.setHex(0x442222);
        setTimeout(() => this.scene.remove(this.group), 2000);
    }

    update(dt, player) {
        if (!this.alive) return;

        const dir = new THREE.Vector3().subVectors(player.position, this.pos);
        const dist = dir.length();
        dir.y = 0;
        if (dir.length() > 0.001) dir.normalize();

        // face player
        this.group.lookAt(this.pos.clone().add(dir));
        this.healthBar.lookAt(player.camera.position);

        // bob
        this.group.position.y = 0.5 + Math.sin((performance.now() + this.offset) * 0.003) * 0.02;

        // AI
        const cfg = this.cfg;
        const now = performance.now();

        if (cfg === ENEMY_TYPES.shooter) {
            // keep distance
            if (dist > cfg.range * 0.6) this.pos.add(dir.clone().multiplyScalar(cfg.speed * dt));
            else if (dist < cfg.range * 0.25) this.pos.add(dir.clone().multiplyScalar(-cfg.speed * dt * 0.5));
            if (now - this.lastAtk > cfg.rate && dist < cfg.range + 5) {
                this.shoot(player);
                this.lastAtk = now;
            }
        } else {
            // chase
            if (dist > cfg.range) this.pos.add(dir.clone().multiplyScalar(cfg.speed * dt));
            // melee
            if (dist <= cfg.range + 0.5 && now - this.lastAtk > cfg.rate) {
                player.takeDamage(cfg.dmg);
                this.lastAtk = now;
                document.getElementById('damage-overlay')?.classList.add('hit');
                setTimeout(() => document.getElementById('damage-overlay')?.classList.remove('hit'), 100);
            }
        }

        this.group.position.copy(this.pos);
    }

    shoot(player) {
        const cfg = this.cfg;
        const dir = new THREE.Vector3().subVectors(player.position, this.pos).normalize();
        dir.x += (Math.random() - 0.5) * 0.08;
        dir.y += (Math.random() - 0.5) * 0.08;
        dir.z += (Math.random() - 0.5) * 0.08;
        dir.normalize();

        const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 4, 4),
            new THREE.MeshStandardMaterial({ color: 0xff44ff, emissive: 0xff44ff, emissiveIntensity: 0.5 })
        );
        sphere.position.copy(this.pos);
        sphere.position.y += 1;
        this.scene.add(sphere);

        this.bullets.push({
            pos: sphere.position.clone(),
            dir: dir,
            speed: 25,
            dmg: cfg.dmg,
            alive: true,
            mesh: sphere,
            origin: sphere.position.clone(),
        });
    }
}
