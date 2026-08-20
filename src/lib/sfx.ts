let audio: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!enabled()) return null;
  if (!audio) audio = new AudioContext();
  if (audio.state === "suspended") void audio.resume();
  return audio;
}

export function sfxEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("blockdice-sound") !== "0";
}

function enabled() {
  return sfxEnabled();
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType = "sine",
  gain = 0.08,
  detune = 0,
) {
  const ac = ctx();
  if (!ac) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (detune) osc.detune.setValueAtTime(detune, t);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur: number, gain = 0.04) {
  const ac = ctx();
  if (!ac) return;
  const t = ac.currentTime;
  const bufferSize = ac.sampleRate * dur;
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const g = ac.createGain();
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1200;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(ac.destination);
  src.start(t);
  src.stop(t + dur);
}

export function sfxClick() {
  tone(880, 0.06, "square", 0.04);
}

export function sfxRoll() {
  tone(220, 0.12, "sawtooth", 0.05);
  window.setTimeout(() => tone(280, 0.1, "sawtooth", 0.04), 60);
}

export function sfxLand() {
  tone(140, 0.08, "square", 0.09);
  tone(90, 0.14, "sine", 0.07);
  noise(0.08, 0.03);
}

export function sfxWin() {
  [523, 659, 784, 1047].forEach((f, i) => {
    window.setTimeout(() => tone(f, 0.22, "square", 0.06), i * 90);
  });
}

export function sfxTick() {
  tone(640, 0.04, "square", 0.025);
}
