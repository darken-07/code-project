// ============================================================
// main.js - 游戏入口：启动、主循环、波次、射击、特效
// ============================================================
import * as THREE from 'three';
import { createScene } from './scene.js';
import { Player, initControls, requestPointerLock, isLocked, isKeyDown } from './player.js';
import { EnemyManager } from './enemy.js';
import { PickupManager } from './game.js';
import { AudioManager } from './audio.js';
import { WeatherManager } from './weather.js';
import { WeaponEffects } from './effects.js';
import { updateHUD, showGameOver, hideGameOver } from './hud.js';

// ===== 全局状态 =====
let gameRunning = false;
let score = 0;
let kills = 0;
let wave = 0;
let waveCountdown = 0;
let inWave = false;
let waveStartAnnounced = false;

// 子系统引用（重启时清理需要）
let sceneRef, cameraRef, rendererRef, playerRef;
let enemyManagerRef, pickupManagerRef, audioManagerRef;
let weatherManagerRef, weaponEffectsRef;

// ===== 射击光线（从相机中心发射，用于瞄准检测） =====
const _raycaster = new THREE.Raycaster();
const _crosshairTarget = new THREE.Vector3();

/**
 * 从相机中心发射射线，返回世界空间中的瞄准方向。
 * 用于第三人称：子弹从枪口发出，但方向由相机准星决定。
 */
function getAimDirection(camera) {
    _raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    // 向前投射很远的距离得到瞄准点
    const farPoint = new THREE.Vector3();
    _raycaster.ray.at(200, farPoint);
    return _raycaster.ray.direction.clone();
}

/**
 * 从相机中心发射射线，与敌人进行碰撞检测（墙面检测由raycaster自动处理）。
 * 返回 hitting 距离最近的敌人的引用。
 */
function raycastEnemies(camera, enemyManager) {
    _raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    return enemyManager.hitTest(
        _raycaster.ray.origin,
        _raycaster.ray.direction
    );
}

// ===== 启动游戏 =====
async function startGame() {
    // 隐藏菜单，显示 HUD
    document.getElementById('menu').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    hideGameOver();

    // 重置全局状态
    score = 0;
    kills = 0;
    wave = 0;
    waveCountdown = 2;
    inWave = false;
    waveStartAnnounced = false;

    // ---- 初始化场景 ----
    const { scene, camera, renderer, buildings } = createScene();
    sceneRef = scene;
    cameraRef = camera;
    rendererRef = renderer;

    // ---- 初始化玩家 ----
    const player = new Player(camera, scene, buildings);
    playerRef = player;
    initControls();
    requestPointerLock();

    // ---- 敌人管理器 ----
    const enemyManager = new EnemyManager(scene, player);
    enemyManagerRef = enemyManager;

    // ---- 音频系统 ----
    const audio = new AudioManager(camera);
    audioManagerRef = audio;
    audio.init();
    audio.startMusic();

    // ---- 天气系统 ----
    const weather = new WeatherManager(scene);
    weatherManagerRef = weather;
    weather.initSky(); // 启用星空渐变背景

    // ---- 武器特效 ----
    const weaponFx = new WeaponEffects(scene, camera, {
        muzzleFlash: { intensity: 1.2, scale: 1.0 },
        shellCasing: { life: 3000, count: 1 },
        impactSpark: { particleCount: 10, speed: 5, life: 350, color: 0xffcc44 },
        screenShake: { decay: 8, maxShake: 0.4 },
        muzzleSmoke: { life: 1500, scale: 1.0, count: 2 },
        bulletHole: { decay: 10000, maxHoles: 50 },
        tracer: { life: 100, maxTrails: 30 },
    });
    weaponEffectsRef = weaponFx;

    // ---- 拾取物 ----
    const pickups = new PickupManager(scene);
    pickupManagerRef = pickups;

    // ---- 鼠标锁定变化 ----
    document.addEventListener('pointerlockchange', onPointerLockChange);
    document.addEventListener('click', onCanvasClick);

    // ---- 输入键单次触发标记 ----
    let keyQDown = false;
    let keyRDown = false;
    let key1Down = false;
    let key2Down = false;

    // ---- 鼠标状态 ----
    let mouseDown = false;
    let mouseClicked = false;

    // ============= 主循环 =============
    let lastTime = performance.now();
    let fpsCount = 0;
    let fpsAccum = 0;

    function gameLoop() {
        if (!gameRunning) {
            // 清理事件监听
            document.removeEventListener('pointerlockchange', onPointerLockChange);
            document.removeEventListener('click', onCanvasClick);
            return;
        }

        const now = performance.now();
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;

        // ---- FPS 计数 ----
        fpsCount++;
        fpsAccum += dt;
        if (fpsAccum >= 1) {
            fpsAccum -= 1;
            fpsCount = 0;
        }

        // ---- 输入：键按下（单次触发） ----
        if (isKeyDown('KeyR') && !keyRDown) {
            keyRDown = true;
            player.startReload();
            audio.playReload();
        }
        if (!isKeyDown('KeyR')) keyRDown = false;

        if (isKeyDown('Digit1') && !key1Down) {
            key1Down = true;
            player.switchWeapon(0);
        }
        if (!isKeyDown('Digit1')) key1Down = false;

        if (isKeyDown('Digit2') && !key2Down) {
            key2Down = true;
            if (player.weapons.length > 1) player.switchWeapon(1);
        }
        if (!isKeyDown('Digit2')) key2Down = false;

        if (isKeyDown('KeyQ') && !keyQDown) {
            keyQDown = true;
            player.toggleFireMode();
        }
        if (!isKeyDown('KeyQ')) keyQDown = false;

        // ---- 天气切换 ----
        if (isKeyDown('Digit6')) weather.setWeather('clear');
        if (isKeyDown('Digit7')) weather.setWeather('rain');
        if (isKeyDown('Digit8')) weather.setWeather('snow');

        // ---- 更新天气（每帧，包括星空闪烁） ----
        weather.update(dt, player.position);

        // ---- 更新环境光尘粒子 ----
        if (sceneRef.userData && sceneRef.userData.dust) {
            const dust = sceneRef.userData.dust;
            const pos = dust.geometry.attributes.position;
            const array = pos.array;
            const speeds = dust.userData.speeds;
            for (let i = 0; i < array.length / 3; i++) {
                array[i * 3] += speeds[i] * Math.sin(performance.now() * 0.0005 + i) * dt;
                array[i * 3 + 1] += Math.sin(performance.now() * 0.001 + i * 0.5) * 0.003;
                array[i * 3 + 2] += speeds[i] * Math.cos(performance.now() * 0.0005 + i) * dt;
                if (Math.abs(array[i * 3]) > 100) array[i * 3] *= -0.9;
                if (array[i * 3 + 1] > 20 || array[i * 3 + 1] < 0) array[i * 3 + 1] = Math.random() * 5;
                if (Math.abs(array[i * 3 + 2]) > 100) array[i * 3 + 2] *= -0.9;
            }
            pos.needsUpdate = true;
        }

        // ---- 射击处理 ----
        if (isLocked()) {
            const shouldFire = player.autoFire
                ? mouseDown
                : mouseClicked;

            if (shouldFire) {
                // 获取屏幕准星瞄准方向（从相机中心）
                const aimDir = getAimDirection(camera);

                // 传给player.fire()，子弹从枪口出，方向沿准星
                const shot = player.fire(aimDir);
                if (shot) {
                    // 射击音效
                    audio.playShoot(player.autoFire);

                    // 武器特效：枪口火焰、弹壳、烟雾
                    weaponFx.fire(shot.origin, shot.direction, 0.05);

                    // 用屏幕准星射线检测敌人（相机中心→敌人）
                    const hitEnemy = enemyManager.hitTest(camera.position, aimDir);

                    if (hitEnemy) {
                        // 命中位置：从枪口到敌人方向检测精确命中点
                        const hitPos = new THREE.Vector3();
                        const enemyBox = new THREE.Box3().setFromObject(hitEnemy.group);
                        const ray = new THREE.Ray(shot.origin, aimDir);
                        ray.intersectBox(enemyBox, hitPos);

                        if (hitPos.length() > 0) {
                            const hitNorm = new THREE.Vector3(0, 1, 0);
                            weaponFx.onHit(hitPos, hitNorm, aimDir, shot.damage);
                        }

                        // 造成伤害
                        const isDead = hitEnemy.takeDamage(shot.damage);
                        if (isDead) {
                            kills++;
                            score += hitEnemy.cfg.score;
                            audio.playDeath();

                            if (hitPos.length() > 0) {
                                weaponFx.impactSpark.emit(
                                    hitEnemy.group.position.clone().add(new THREE.Vector3(0, 0.8, 0)),
                                    new THREE.Vector3(0, 1, 0)
                                );
                            }
                        } else {
                            score += 5;
                            audio.playHit();
                        }
                    } else {
                        // 未命中：用相机射线检测场景物体
                        _raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
                        const intersects = _raycaster.intersectObjects(scene.children, true);
                        if (intersects.length > 0) {
                            const hitPoint = intersects[0].point;
                            const hitNormal = intersects[0].face?.normal || new THREE.Vector3(0, 1, 0);
                            if (intersects[0].object) {
                                const normalMatrix = new THREE.Matrix3().getNormalMatrix(
                                    intersects[0].object.matrixWorld
                                );
                                hitNormal.applyMatrix3(normalMatrix).normalize();
                            }
                            weaponFx.bulletHole.emit(hitPoint, hitNormal);
                            weaponFx.impactSpark.emit(hitPoint, hitNormal);
                        }
                    }
                }
                if (!player.autoFire) mouseClicked = false;
            }
        }

        // ---- 更新玩家 ----
        player.update(dt);

        // ---- 屏幕震动（在 camera 位置设置后调用） ----
        weaponFx.screenShake.setBasePosition(camera.position.clone());
        weaponFx.screenShake.update(dt);

        // ---- 波次管理 ----
        if (!inWave) {
            waveCountdown -= dt;
            if (waveCountdown <= 0) {
                wave++;
                inWave = true;
                waveStartAnnounced = false;
                const count = enemyManager.startWave(wave);
                waveCountdown = 5; // 波次间隔
            } else {
                // 波次倒计时显示（剩余3秒时开始显示）
                if (waveCountdown <= 3 && !waveStartAnnounced) {
                    // 每波开始提示
                }
            }
        } else {
            // 波次开始时播放音效
            if (!waveStartAnnounced) {
                waveStartAnnounced = true;
                audio.playWaveStart();
            }
            const waveDone = enemyManager.update(dt);
            if (waveDone) {
                inWave = false;
                waveCountdown = 5;
                score += wave * 50; // 波次完成奖励

                // 每5波切换天气增加变化
                if (wave % 5 === 0) {
                    const types = ['rain', 'snow', 'clear'];
                    weather.setWeather(types[Math.floor(Math.random() * types.length)]);
                }
            }
        }

        // ---- 更新拾取物 ----
        pickups.update(player);

        // ---- 更新武器特效 ----
        weaponFx.update(dt);

        // ---- 玩家受伤检测（由enemyManager内部触发） ----
        // 由 enemy 的 update 直接调用 player.takeDamage()

        // ---- 玩家死亡 ----
        if (player.health <= 0) {
            gameRunning = false;
            audio.playDeath();
            audio.stopMusic();

            setTimeout(() => {
                if (document.pointerLockElement) {
                    document.exitPointerLock();
                }
                document.getElementById('hud').style.display = '';
                showGameOver(score, kills, wave);
            }, 500);

            renderer.render(scene, camera);
            return;
        }

        // ---- HUD 更新 ----
        updateHUD(player, score, kills, wave);

        // ---- 渲染 ----
        renderer.render(scene, camera);
        requestAnimationFrame(gameLoop);
    }

    // ---- 事件处理函数 ----
    function onPointerLockChange() {
        if (!document.pointerLockElement && gameRunning) {
            // 鼠标移出时不做特殊处理
        }
    }

    function onCanvasClick() {
        if (gameRunning && !document.pointerLockElement) {
            requestPointerLock();
        }
    }

    // ---- 鼠标事件绑定 ----
    function onMouseDown(e) {
        if (e.button === 0) {
            mouseDown = true;
            mouseClicked = true;
        }
    }
    function onMouseUp(e) {
        if (e.button === 0) {
            mouseDown = false;
        }
    }
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);

    // ---- 重启按钮 ----
    const restartHandler = () => {
        // 清理所有子系统
        enemyManager.clear();
        pickups.clear();
        weaponFx.clear();
        weather.stop();
        audio.stopMusic();

        // 移除 Three.js 渲染器 canvas
        if (renderer.domElement && renderer.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
        }

        // 移除事件监听
        document.removeEventListener('mousedown', onMouseDown);
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('pointerlockchange', onPointerLockChange);
        document.removeEventListener('click', onCanvasClick);
        try { document.getElementById('restart-btn').removeEventListener('click', restartHandler); } catch (e) {}

        document.getElementById('hud').style.display = 'none';
        gameRunning = false;

        // 延迟重新启动
        setTimeout(() => startGame(), 100);
    };
    document.getElementById('restart-btn').addEventListener('click', restartHandler);

    // ---- 开始循环 ----
    gameRunning = true;
    gameLoop();
}

// ===== 启动 =====
document.getElementById('start-btn').addEventListener('click', startGame);

// 允许按回车启动
document.addEventListener('keydown', (e) => {
    if (e.code === 'Enter' && document.getElementById('menu').style.display !== 'none') {
        startGame();
    }
});
