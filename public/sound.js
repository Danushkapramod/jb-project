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

  playMessageBeep() {
    // Crisp 2-note message notification chime (like regular WhatsApp / SMS message)
    this.playBeep(784, 0.09, 'sine'); // G5
    setTimeout(() => this.playBeep(1046.5, 0.16, 'sine'), 100); // C6
  }

  playJobChime() {
    this.playMessageBeep();
  }

  startAlarm() {
    // Play ONLY ONCE like a regular incoming message (no continuous repeating beep)
    this.stopAlarm();
    this.playMessageBeep();
  }

  stopAlarm() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

window.soundAlert = new SoundAlert();
