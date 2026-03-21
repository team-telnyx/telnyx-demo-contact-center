const DTMF_FREQS = {
  '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
  '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
  '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
  '*': [941, 1209], '0': [941, 1336], '#': [941, 1477],
};

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

export function playDTMF(key, duration = 100) {
  const freqs = DTMF_FREQS[key];
  if (!freqs) return;

  const ctx = getAudioContext();
  const gain = ctx.createGain();
  gain.gain.value = 0.15;
  gain.connect(ctx.destination);

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  osc1.frequency.value = freqs[0];
  osc2.frequency.value = freqs[1];
  osc1.type = 'sine';
  osc2.type = 'sine';

  osc1.connect(gain);
  osc2.connect(gain);

  const now = ctx.currentTime;
  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + duration / 1000);
  osc2.stop(now + duration / 1000);

  gain.gain.setValueAtTime(0.15, now + duration / 1000 - 0.01);
  gain.gain.linearRampToValueAtTime(0, now + duration / 1000);
}
