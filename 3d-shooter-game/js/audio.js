// audio.js
import * as THREE from 'three';

export class AudioManager {
  constructor(camera) {
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);
    this.ctx = null; // AudioContext
    this.musicGain = null;
    this.sfxGain = null;
    this.musicPlaying = false;
    this.oscillators = [];
  }

  init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.15;
    this.musicGain.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.4;
    this.sfxGain.connect(this.ctx.destination);
  }

  startMusic() {
    if (this.musicPlaying) return;
    this.musicPlaying = true;
    this._playAmbientPad();
  }

  stopMusic() {
    this.musicPlaying = false;
    for (const o of this.oscillators) {
      try { o.stop(); } catch(e) {}
    }
    this.oscillators = [];
  }

  // 氛围音垫 - 产生类似合成器的背景音
  _playAmbientPad() {
    if (!this.musicPlaying || !this.ctx) return;
    const now = this.ctx.currentTime;
    const baseFreq = 65.41; // C2

    // 创建多层音垫
    const notes = [0, 4, 7, 12]; // C E G C 和弦
    for (const semitone of notes) {
      const freq = baseFreq * Math.pow(2, semitone / 12);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.03, now + 1);
      gain.gain.linearRampToValueAtTime(0.02, now + 3);
      // 缓慢波动
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 0.1 + Math.random() * 0.2;
      lfoGain.gain.value = 0.005;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      lfo.start();
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start();
      this.oscillators.push(osc, lfo);
    }

    // 低频打击乐（心跳般）
    const beatOsc = this.ctx.createOscillator();
    const beatGain = this.ctx.createGain();
    beatOsc.type = 'sine';
    beatOsc.frequency.value = 40;
    beatGain.gain.setValueAtTime(0, now);
    this._scheduleHeartBeat(now, beatGain);
    beatOsc.connect(beatGain);
    beatGain.connect(this.musicGain);
    beatOsc.start();
    this.oscillators.push(beatOsc);
  }

  _scheduleHeartBeat(time, gainNode) {
    if (!this.musicPlaying) return;
    const bpm = 60;
    const interval = 60 / bpm;
    for (let i = 0; i < 8; i++) {
      const t = time + i * interval;
      gainNode.gain.setValueAtTime(0, t);
      gainNode.gain.linearRampToValueAtTime(0.08, t + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, t + 0.15);
      // 第二个拍
      const t2 = t + interval * 0.5;
      gainNode.gain.linearRampToValueAtTime(0.04, t2 + 0.03);
      gainNode.gain.linearRampToValueAtTime(0, t2 + 0.1);
    }
    setTimeout(() => {
      this._scheduleHeartBeat(time + 8 * interval, gainNode);
    }, 8000 * interval / 60 * 1000);
  }

  // === 音效 ===
  playShoot(auto = false) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const noise = this.ctx.createBufferSource();
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.08, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.01));
    noise.buffer = buf;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.06);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    noise.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    osc.start(now); osc.stop(now + 0.08);
    noise.start(now); noise.stop(now + 0.08);
  }

  playReload() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // "咔哒"声 x 2
    for (let i = 0; i < 2; i++) {
      const t = now + i * 0.3;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(2000 - i * 500, t);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t); osc.stop(t + 0.05);
    }
  }

  playHit() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now); osc.stop(now + 0.1);
  }

  playDeath() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + 0.5);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now); osc.stop(now + 0.5);
  }

  playPickup() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now); osc.stop(now + 0.2);
  }

  playDamage() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now); osc.stop(now + 0.15);
  }

  playWaveStart() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.15;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300 + i * 200, t);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t); osc.stop(t + 0.12);
    }
  }

  // 用于自定义MP3背景音乐
  setCustomMusic(url) {
    // 保留接口：用户可以将MP3文件放入项目后调用
    // const audio = new Audio(url);
    // audio.loop = true;
    // audio.volume = 0.3;
    // audio.play();
  }

  setVolume(type, val) {
    if (type === 'music' && this.musicGain) this.musicGain.gain.value = val;
    if (type === 'sfx' && this.sfxGain) this.sfxGain.gain.value = val;
  }
}
