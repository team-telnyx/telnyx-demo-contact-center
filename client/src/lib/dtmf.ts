// DTMF tone frequencies (dual-tone multi-frequency)
const DTMF_FREQUENCIES: Record<string, [number, number]> = {
  '1': [697, 1209],
  '2': [697, 1336],
  '3': [697, 1477],
  '4': [770, 1209],
  '5': [770, 1336],
  '6': [770, 1477],
  '7': [852, 1209],
  '8': [852, 1336],
  '9': [852, 1477],
  '*': [941, 1209],
  '0': [941, 1336],
  '#': [941, 1477],
};

export function playDtmfBeep(digit: string, audioCtxRef: React.MutableRefObject<AudioContext | null>) {
  const freqs = DTMF_FREQUENCIES[digit];
  if (!freqs) return;

  try {
    // Create or reuse AudioContext
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;

    // Create oscillators for dual tones
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.frequency.value = freqs[0];
    osc2.frequency.value = freqs[1];

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Set volume and duration
    gainNode.gain.value = 0.1;
    const now = ctx.currentTime;
    const duration = 0.1; // 100ms beep

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration);
    osc2.stop(now + duration);
  } catch (error) {
    console.warn('Failed to play DTMF beep:', error);
  }
}
