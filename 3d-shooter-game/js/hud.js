// ============================================================
// hud.js - HUD界面更新
// ============================================================

export function updateHUD(player, score, kills, wave) {
    // 健康
    const healthEl = document.getElementById('health-text');
    if (healthEl) {
        healthEl.textContent = `❤️ ${Math.ceil(player.health)}`;
        healthEl.style.color = player.health > 50 ? '#4f4' : player.health > 25 ? '#ff0' : '#f44';
    }

    // 弹药
    const ammoEl = document.getElementById('ammo-text');
    const weaponEl = document.getElementById('weapon-name');
    if (ammoEl) {
        const w = player.weapon;
        ammoEl.textContent = `${w.ammo} / ${w.maxAmmo}`;
        if (player.isReloading) {
            ammoEl.textContent = '🔄 换弹中...';
        }
    }
    if (weaponEl) {
        weaponEl.textContent = player.weapon.name;
    }

    // 分数
    const scoreEl = document.getElementById('score-value');
    if (scoreEl) scoreEl.textContent = score;

    // 击杀
    const killEl = document.getElementById('kill-value');
    if (killEl) killEl.textContent = kills;

    // 波次
    const waveEl = document.getElementById('wave-value');
    if (waveEl) waveEl.textContent = wave;

    // 射击模式
    const modeEl = document.getElementById('fire-mode-text');
    if (modeEl) {
        modeEl.textContent = player.autoFire ? '自动' : '单发';
    }
}

export function showGameOver(score, kills, wave) {
    document.getElementById('game-over').style.display = 'flex';
    document.getElementById('final-score').textContent = score;
    document.getElementById('final-kills').textContent = kills;
    document.getElementById('final-wave').textContent = wave;
}

export function hideGameOver() {
    document.getElementById('game-over').style.display = 'none';
}
