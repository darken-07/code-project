// ============================================================
// scene.js - 3D场景、光照、地面、建筑物
// ============================================================
import * as THREE from 'three';

export function createScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1e);
    scene.fog = new THREE.Fog(0x0a0a1e, 120, 250);

    // ---- 相机 ----
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);
    camera.position.set(0, 1.6, 0);

    // ---- 渲染器 ----
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    document.body.appendChild(renderer.domElement);

    // ---- 窗口缩放 ----
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // ---- 环境光 ----
    const ambient = new THREE.AmbientLight(0x404070, 0.6);
    scene.add(ambient);

    // ---- 半球光 ----
    const hemi = new THREE.HemisphereLight(0x88ccff, 0x221122, 0.5);
    scene.add(hemi);

    // ---- 主定向光 ----
    const sun = new THREE.DirectionalLight(0xffeedd, 1.0);
    sun.position.set(50, 100, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.1;
    sun.shadow.camera.far = 200;
    sun.shadow.camera.left = -100;
    sun.shadow.camera.right = 100;
    sun.shadow.camera.top = 100;
    sun.shadow.camera.bottom = -100;
    scene.add(sun);

    // ---- 环境微光（城市辉光） ----
    const ambientFog = new THREE.AmbientLight(0x334466, 0.3);
    scene.add(ambientFog);

    // ---- 地面 ----
    // 创建更精细的地面：沥青底色 + 车道标记 + 纹理感
    const groundGeo = new THREE.PlaneGeometry(300, 300, 60, 60);
    const groundMat = new THREE.MeshStandardMaterial({
        color: 0x1a1a30,
        roughness: 0.9,
        metalness: 0.1,
        flatShading: true,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // 地面网格车道（发光线条）
    const laneMat = new THREE.MeshBasicMaterial({
        color: 0x4444aa,
        transparent: true,
        opacity: 0.15,
    });
    for (let i = -6; i <= 6; i++) {
        if (i === 0) continue;
        const lane = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 140), laneMat);
        lane.rotation.x = -Math.PI / 2;
        lane.position.set(i * 4, 0.07, 0);
        scene.add(lane);
    }
    for (let i = -6; i <= 6; i++) {
        if (i === 0) continue;
        const lane = new THREE.Mesh(new THREE.PlaneGeometry(140, 0.05), laneMat);
        lane.rotation.x = -Math.PI / 2;
        lane.position.set(0, 0.07, i * 4);
        scene.add(lane);
    }

    // ---- 网格装饰 ----
    const grid = new THREE.GridHelper(300, 30, 0x4444cc, 0x3333aa);
    grid.position.y = 0.05;
    scene.add(grid);

    // ---- 道路标线 ----
    createRoadMarkings(scene);

    // ---- 大型广告牌 ----
    createBillboards(scene);

    // ---- 建筑物 ----
    const buildings = createBuildings();
    buildings.forEach(b => scene.add(b));

    // ---- 边缘围墙 ----
    createWalls(scene);

    // ---- 随机杂物 ----
    createDebris(scene);

    // ---- 环境漂浮粒子（城市光尘） ----
    createAmbientDust(scene);

    return { scene, camera, renderer, buildings };
}

// ===== 建筑物 =====
function createBuildings() {
    const buildings = [];
    const colors = [0x3a3a5e, 0x4a4a6e, 0x2e2e4e, 0x5a3a4e, 0x3a4a5e, 0x4a3a5e];
    const positions = [];

    const count = 18 + Math.floor(Math.random() * 7);
    for (let i = 0; i < count; i++) {
        const w = 3 + Math.random() * 6;
        const d = 3 + Math.random() * 6;
        const h = 2 + Math.random() * 12;

        let x, z, valid;
        let attempts = 0;
        do {
            x = (Math.random() - 0.5) * 120;
            z = (Math.random() - 0.5) * 120;
            valid = true;

            if (Math.abs(x) < 6 && Math.abs(z) < 6) valid = false;

            for (const p of positions) {
                if (Math.abs(x - p.x) < w / 2 + p.w / 2 + 2 &&
                    Math.abs(z - p.z) < d / 2 + p.d / 2 + 2) {
                    valid = false;
                    break;
                }
            }
            attempts++;
        } while (!valid && attempts < 50);

        if (!valid) continue;
        positions.push({ x, z, w, d });

        const group = new THREE.Group();

        const geo = new THREE.BoxGeometry(w, h, d);
        const mat = new THREE.MeshStandardMaterial({
            color: colors[Math.floor(Math.random() * colors.length)],
            roughness: 0.8,
            metalness: 0.2,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, h / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);

        // 屋顶
        const roofMat = new THREE.MeshStandardMaterial({
            color: 0x222244,
            roughness: 0.9,
        });
        const roof = new THREE.Mesh(
            new THREE.BoxGeometry(w + 0.5, 0.3, d + 0.5),
            roofMat
        );
        roof.position.set(x, h + 0.15, z);
        roof.castShadow = true;
        roof.receiveShadow = true;
        group.add(roof);

        // 窗户（发光）
        const winMat = new THREE.MeshStandardMaterial({
            color: 0x88bbff,
            emissive: 0x88bbff,
            emissiveIntensity: 0.1 + Math.random() * 0.4,
            transparent: true,
            opacity: 0.6,
        });
        for (let side = 0; side < 4; side++) {
            const windowCount = Math.floor(h / 3);
            for (let wi = 0; wi < windowCount; wi++) {
                const wy = 1.5 + wi * 2.5;
                const ww = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.2), winMat.clone());
                const offsetX = (side === 0) ? w / 2 + 0.01 : (side === 1) ? -w / 2 - 0.01 : 0;
                const offsetZ = (side === 2) ? d / 2 + 0.01 : (side === 3) ? -d / 2 - 0.01 : 0;
                ww.position.set(x + offsetX, wy, z + offsetZ);
                if (side === 0 || side === 1) {
                    ww.rotation.y = (side === 0) ? Math.PI / 2 : -Math.PI / 2;
                }
                group.add(ww);
            }
        }

        buildings.push(group);

        // 给部分建筑添加霓虹灯招牌
        if (Math.random() < 0.35) {
            createNeonSign(group, x, z, w, h, d);
        }
    }

    return buildings;
}

// ===== 霓虹灯招牌 =====
const NEON_COLORS = [0xff0044, 0x00ff88, 0xffaa00, 0x44aaff, 0xff44ff, 0x00ffcc];

function createNeonSign(group, bx, bz, bw, bh, bd) {
    const color = NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)];
    const signW = 1 + Math.random() * 1.5;
    const signH = 0.4 + Math.random() * 0.3;
    const side = Math.floor(Math.random() * 4);
    const yPos = 1.5 + Math.random() * (bh - 2);

    // 发光招牌底板
    const signMat = new THREE.MeshStandardMaterial({
        color: 0x111122,
        emissive: color,
        emissiveIntensity: 0.05,
        roughness: 0.3,
        metalness: 0.8,
    });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(signW, signH, 0.05), signMat);

    switch (side) {
        case 0: sign.position.set(bx + bw/2 + 0.05, yPos, bz); sign.rotation.y = Math.PI/2; break;
        case 1: sign.position.set(bx - bw/2 - 0.05, yPos, bz); sign.rotation.y = -Math.PI/2; break;
        case 2: sign.position.set(bx, yPos, bz + bd/2 + 0.05); break;
        case 3: sign.position.set(bx, yPos, bz - bd/2 - 0.05); break;
    }
    group.add(sign);

    // 霓虹灯管（边框发光）
    const neonMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.7,
    });
    const frame = new THREE.Mesh(new THREE.EdgesGeometry(new THREE.BoxGeometry(signW, signH, 0.06)), neonMat);
    frame.position.copy(sign.position);
    frame.rotation.copy(sign.rotation);
    group.add(frame);

    // 点光源（霓虹灯发光效果）
    const light = new THREE.PointLight(color, 0.3, 8);
    light.position.copy(sign.position);
    group.add(light);

    // 发光光晕球体
    const glowMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.15,
    });
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.4, 6, 6), glowMat);
    glow.position.copy(sign.position);
    glow.position.x += (Math.random() - 0.5) * 0.5;
    glow.position.y += (Math.random() - 0.5) * 0.3;
    group.add(glow);
}

// ===== 道路标线 =====
function createRoadMarkings(scene) {
    const stripeMat = new THREE.MeshBasicMaterial({
        color: 0x6666aa,
        transparent: true,
        opacity: 0.3,
    });

    // 四条主要道路上的虚线
    for (let dir = 0; dir < 4; dir++) {
        const angle = (dir / 4) * Math.PI * 2;
        for (let i = 0; i < 20; i++) {
            const dist = 8 + i * 4;
            const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 1.5), stripeMat);
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;
            stripe.position.set(x, 0.06, z);
            stripe.rotation.x = -Math.PI / 2;
            stripe.rotation.z = -angle;
            scene.add(stripe);
        }
    }

    // 十字路口中心标记
    const centerMat = new THREE.MeshBasicMaterial({
        color: 0x4444aa,
        transparent: true,
        opacity: 0.2,
    });
    const centerCircle = new THREE.Mesh(new THREE.RingGeometry(1, 2, 32), centerMat);
    centerCircle.rotation.x = -Math.PI / 2;
    centerCircle.position.y = 0.06;
    scene.add(centerCircle);
}

// ===== 广告牌 =====
function createBillboards(scene) {
    const billboardColors = [0xff4444, 0x44ff44, 0x4444ff, 0xffff44, 0xff44ff, 0x44ffff];

    for (let i = 0; i < 12; i++) {
        const color = billboardColors[Math.floor(Math.random() * billboardColors.length)];
        const billW = 2 + Math.random() * 2;
        const billH = 1.5 + Math.random() * 1;
        const angle = Math.random() * Math.PI * 2;
        const radius = 10 + Math.random() * 30;

        const group = new THREE.Group();

        // 支柱
        const poleMat = new THREE.MeshStandardMaterial({
            color: 0x555577,
            metalness: 0.6,
            roughness: 0.4,
        });
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.5), poleMat);
        pole.position.y = 1.25;
        pole.castShadow = true;
        group.add(pole);

        // 广告牌面
        const boardMat = new THREE.MeshStandardMaterial({
            color: 0x111122,
            emissive: color,
            emissiveIntensity: 0.15,
            roughness: 0.5,
            metalness: 0.3,
        });
        const board = new THREE.Mesh(new THREE.BoxGeometry(billW, billH, 0.06), boardMat);
        board.position.y = 2.8;
        board.castShadow = true;
        group.add(board);

        // 边框发光
        const borderMat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.5,
        });
        const border = new THREE.Mesh(
            new THREE.EdgesGeometry(new THREE.BoxGeometry(billW, billH, 0.07)),
            borderMat
        );
        border.position.copy(board.position);
        group.add(border);

        // 点光源
        const light = new THREE.PointLight(color, 0.2, 10);
        light.position.set(0, 2.8, 0.5);
        group.add(light);

        // 放置
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        // 避开中心区域
        if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;
        group.position.set(x, 0, z);
        group.rotation.y = Math.random() * Math.PI * 2;
        scene.add(group);
    }
}

// ===== 环境光尘粒子 =====
function createAmbientDust(scene) {
    const count = 300;
    const positions = new Float32Array(count * 3);
    const speeds = [];

    for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 200;
        positions[i * 3 + 1] = Math.random() * 20;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
        speeds.push(0.02 + Math.random() * 0.05);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
        color: 0x8888ff,
        size: 0.08,
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const dust = new THREE.Points(geo, mat);
    dust.position.y = 0;
    scene.add(dust);

    // 存储引用以便动画
    dust.userData = { speeds, offset: 0 };
    // 在场景对象上存储以便主循环更新
    scene.userData.dust = dust;
}

// ===== 围墙 =====
function createWalls(scene) {
    const wallMat = new THREE.MeshStandardMaterial({
        color: 0x333355,
        roughness: 0.9,
        metalness: 0.1,
        transparent: true,
        opacity: 0.7,
    });
    const size = 145;
    const h = 4;

    const positions = [
        { x: 0, z: -size, ry: 0 },
        { x: 0, z: size, ry: 0 },
        { x: -size, z: 0, ry: Math.PI / 2 },
        { x: size, z: 0, ry: Math.PI / 2 },
    ];

    for (const p of positions) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(size * 2, h, 1), wallMat);
        wall.position.set(p.x, h / 2, p.z);
        wall.receiveShadow = true;
        scene.add(wall);
    }

    // 围墙顶部的红色警示灯
    const lightMat = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 0.5,
    });
    for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2;
        const r = 145;
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), lightMat.clone());
        lamp.position.set(Math.cos(angle) * r, 4, Math.sin(angle) * r);
        scene.add(lamp);

        const pl = new THREE.PointLight(0xff0000, 0.1, 10);
        pl.position.copy(lamp.position);
        scene.add(pl);
    }
}

// ===== 杂物 =====
function createDebris(scene) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x444466, roughness: 0.9 });
    for (let i = 0; i < 50; i++) {
        const box = new THREE.Mesh(
            new THREE.BoxGeometry(0.5 + Math.random() * 1.5, 0.3 + Math.random() * 0.8, 0.5 + Math.random() * 1.5),
            mat
        );
        box.position.set(
            (Math.random() - 0.5) * 130,
            0.15 + Math.random() * 0.3,
            (Math.random() - 0.5) * 130
        );
        if (Math.abs(box.position.x) < 5 && Math.abs(box.position.z) < 5) continue;
        box.rotation.y = Math.random() * Math.PI;
        box.castShadow = true;
        box.receiveShadow = true;
        scene.add(box);
    }

    // 路灯
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x666688, metalness: 0.5, roughness: 0.4 });
    const lampMat = new THREE.MeshStandardMaterial({
        color: 0xffffaa,
        emissive: 0xffdd88,
        emissiveIntensity: 0.3,
    });
    for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2;
        const radius = 25 + Math.random() * 20;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 2.5), poleMat);
        pole.position.set(x, 1.25, z);
        pole.castShadow = true;
        scene.add(pole);

        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3), lampMat);
        lamp.position.set(x, 2.8, z);
        scene.add(lamp);

        if (i % 2 === 0) {
            const pl = new THREE.PointLight(0xffdd88, 0.3, 15);
            pl.position.set(x, 2.5, z);
            scene.add(pl);
        }
    }
}
