// ============================================================
// scene.js - 3D场景、光照、地面、建筑物
// ============================================================
import * as THREE from 'three';

export function createScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.Fog(0x1a1a2e, 80, 200);

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
    const ambient = new THREE.AmbientLight(0x404060, 0.5);
    scene.add(ambient);

    // ---- 半球光 ----
    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x362d1e, 0.6);
    scene.add(hemi);

    // ---- 主定向光 ----
    const sun = new THREE.DirectionalLight(0xffeedd, 1.2);
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

    // ---- 地面 ----
    const groundGeo = new THREE.PlaneGeometry(300, 300);
    const groundMat = new THREE.MeshStandardMaterial({
        color: 0x2a2a3e,
        roughness: 0.9,
        metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // ---- 网格装饰 ----
    const grid = new THREE.GridHelper(300, 30, 0x4444aa, 0x333366);
    grid.position.y = 0.05;
    scene.add(grid);

    // ---- 建筑物 ----
    const buildings = createBuildings();
    buildings.forEach(b => scene.add(b));

    // ---- 边缘围墙 ----
    createWalls(scene);

    // ---- 随机杂物 ----
    createDebris(scene);

    return { scene, camera, renderer, buildings };
}

// ===== 建筑物 =====
function createBuildings() {
    const buildings = [];
    const colors = [0x3a3a5e, 0x4a4a6e, 0x2e2e4e, 0x5a3a4e, 0x3a4a5e];
    const positions = [];

    // 生成15-20栋建筑
    const count = 16 + Math.floor(Math.random() * 6);
    for (let i = 0; i < count; i++) {
        const w = 3 + Math.random() * 6;
        const d = 3 + Math.random() * 6;
        const h = 2 + Math.random() * 10;

        let x, z, valid;
        let attempts = 0;
        do {
            x = (Math.random() - 0.5) * 120;
            z = (Math.random() - 0.5) * 120;
            valid = true;

            // 不要离中心太近（玩家出生点）
            if (Math.abs(x) < 6 && Math.abs(z) < 6) valid = false;

            // 不要相互重叠
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

        // 主体
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

        // 窗户
        const winMat = new THREE.MeshStandardMaterial({
            color: 0x88bbff,
            emissive: 0x88bbff,
            emissiveIntensity: Math.random() * 0.3,
            transparent: true,
            opacity: 0.6,
        });
        for (let side = 0; side < 4; side++) {
            const windowCount = Math.floor(h / 3);
            for (let wi = 0; wi < windowCount; wi++) {
                const wy = 1.5 + wi * 2.5;
                const ww = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.2), winMat.clone());
                // windows on each face
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
    }

    return buildings;
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
}

// ===== 杂物 =====
function createDebris(scene) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x444466, roughness: 0.9 });
    for (let i = 0; i < 40; i++) {
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
    const lightMat = new THREE.MeshStandardMaterial({
        color: 0xffffaa,
        emissive: 0xffdd88,
        emissiveIntensity: 0.3,
    });
    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const radius = 25 + Math.random() * 20;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 2.5), poleMat);
        pole.position.set(x, 1.25, z);
        pole.castShadow = true;
        scene.add(pole);

        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3), lightMat);
        lamp.position.set(x, 2.8, z);
        scene.add(lamp);

        // 点光源（部分亮）
        if (i % 2 === 0) {
            const pl = new THREE.PointLight(0xffdd88, 0.3, 15);
            pl.position.set(x, 2.5, z);
            scene.add(pl);
        }
    }
}
