// ============================================================
// main.js - 游戏入口：启动、循环、控制
// ============================================================
import * as THREE from 'three';
import { createScene } from './scene.js';
import { Player, initControls, requestPointerLock, isLocked, isKeyDown } from './player.js';
import { EnemyManager } from './enemy.js';
import { BulletEffects, PickupManager } from './game.js';
import { updateHUD, showGameOver, hideGameOver } from './hud.js';

// ===== 全局状态 =====
let gameRunning = false;
let score = 0;
let kills = 0;
let wave = 0;
let waveCountdown = 0;
let inWave = false;

// ===== 启动游戏 =====
async function startGame() {
    // 隐藏菜单
    document.getElementById('menu').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    hideGameOver();

    // 初始化场景
    const { scene, camera, renderer, buildings } = createScene();

    // 初始化玩家
    const player = new Player(camera, scene, buildings);
    initControls();
    requestPointerLock();

    // 敌人管理器
    const enemyManager = new EnemyManager(scene, player);

    // 特效
    const fx = new BulletEffects(scene);

    // 拾取物
    const pickups = new PickupManager(scene);

    // 底部武器指示器（简化用hud）
    let lastShotTime = 0;
    const shotCooldown = 100;

    // 游戏中不能锁指针时的处理
    document.addEventListener('pointerlockchange', () => {
        if (!document.pointerLockElement && gameRunning) {
            // 点击重新锁定
        }
    });
    document.addEventListener('click', () => {
        if (gameRunning && !document.pointerLockElement) {
            requestPointerLock();
        }
    });

    // ===== 主循环 =====
    let lastTime = performance.now();
    let fps = 0;
    let fpsTimer = 0;

    function gameLoop() {
        if (!gameRunning) return;

        const now = performance.now();
        const dt = Math.min((now - lastTime) / 1000, 0.05); // cap at 50ms
        lastTime = now;

        // FPS
        fps++;
        fpsTimer += dt;
        if (fpsTimer >= 1) {
            fpsTimer -= 1;
            // console.log(`FPS: ${fps}`);
            fps = 0;
        }

        // ---- 输入处理 ----
        if (isKeyDown('KeyR')) {
            player.startReload();
        }
        if (isKeyDown('Digit1')) {
            player.switchWeapon(0);
        }
        if (isKeyDown('Digit2') && player.weapons.length > 1) {
            player.switchWeapon(1);
        }
        if (isKeyDown('KeyQ')) {
            // toggle once
            if (!window._qPressed) {
                player.toggleFireMode();
                window._qPressed = true;
            }
        } else {
            window._qPressed = false;
        }

        // ---- 射击 ----
        if (isLocked()) {
            const firePressed = player.autoFire
                ? (window._mouseDown || false)
                : (window._mouseClicked || false);

            if ((player.autoFire && window._mouseDown) ||
                (!player.autoFire && window._mouseClicked)) {
                const shot = player.fire();
                if (shot) {
                    // tracer
                    fx.addTracer(shot.origin, shot.direction);
                    fx.addMuzzleFlash(shot.origin);

                    // 检测敌人
                    const hit = enemyManager.hitTest(shot.origin, shot.direction);
                    if (hit) {
                        const isDead = hit.takeDamage(shot.damage);
                        if (isDead) {
                            kills++;
                            score += hit.cfg.score;
                        } else {
                            score += 5; // 命中得分
                        }
                    }
                }
                if (!player.autoFire) window._mouseClicked = false;
            }
        }

        // ---- 更新 ----
        player.update(dt);

        // 波次管理
        if (!inWave) {
            waveCountdown -= dt;
            if (waveCountdown <= 0) {
                wave++;
                inWave = true;
                const count = enemyManager.startWave(wave);
                waveCountdown = 3; // 波次间等待3秒
            }
        } else {
            const done = enemyManager.update(dt);
            if (done) {
                inWave = false;
                waveCountdown = 3; // 3秒后下一波
                score += wave * 50; // 波次完成奖励
            }
        }

        // 更新拾取物
        pickups.update(player);

        // 更新特效
        fx.update();

        // ---- 玩家死亡 ----
        if (player.health <= 0) {
            gameRunning = false;
            // 显示游戏结束
            setTimeout(() => {
                if (document.pointerLockElement) {
                    document.exitPointerLock();
                }
                showGameOver(score, kills, wave);
                document.getElementById('hud').style.display = '';
                document.getElementById('game-over').style.display = 'flex';
            }, 500);
            renderer.render(scene, camera);
            return;
        }

        // ---- HUD ----
        updateHUD(player, score, kills, wave);

        // ---- 渲染 ----
        renderer.render(scene, camera);
        requestAnimationFrame(gameLoop);
    }

    // ---- 事件绑定 ----
    window._mouseDown = false;
    window._mouseClicked = false;
    window._qPressed = false;

    document.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            window._mouseDown = true;
            window._mouseClicked = true;
        }
    });
    document.addEventListener('mouseup', (e) => {
        if (e.button === 0) {
            window._mouseDown = false;
        }
    });

    // 重启按钮
    document.getElementById('restart-btn').addEventListener('click', () => {
        // 清理
        enemyManager.clear();
        pickups.clear();
        // 重置状态
        document.getElementById('hud').style.display = 'none';
        document.getElementById('game-over').style.display = 'none';

        // 移除渲染器
        renderer.domElement.remove();

        gameRunning = false;
        startGame();
    });

    // 开始循环
    gameRunning = true;
    waveCountdown = 2;
    gameLoop();

    // 如果点击菜单外部，重新获取锁
    renderer.domElement.addEventListener('click', () => {
        if (gameRunning && !document.pointerLockElement) {
            requestPointerLock();
        }
    });
}

// ===== 启动 =====
document.getElementById('start-btn').addEventListener('click', startGame);

// 也允许点击其他区域启动
document.addEventListener('keydown', (e) => {
    if (e.code === 'Enter' && document.getElementById('menu').style.display !== 'none') {
        startGame();
    }
});
