// Web Audio API Synthesizer for PickMe / Uber style incoming job chime
class SoundAlert {
  constructor() {
    this.audioCtx = null;
    this.intervalId = null;
  }

  init() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playBeep(freq = 880, duration = 0.15, type = 'sine') {
    this.init();
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

      gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {
      console.warn('Audio playback not permitted or failed:', e);
    }
  }

  playJobChime() {
    // 3-note ascending chime (like a modern notification/dispatch chime)
    this.playBeep(523.25, 0.12, 'triangle'); // C5
    setTimeout(() => this.playBeep(659.25, 0.12, 'triangle'), 130); // E5
    setTimeout(() => this.playBeep(783.99, 0.25, 'triangle'), 260); // G5
  }

  startAlarm() {
    this.playJobChime();
    this.stopAlarm(); // clear any previous
    this.intervalId = setInterval(() => {
      this.playJobChime();
    }, 1500);
  }

  stopAlarm() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

window.soundAlert = new SoundAlert();
