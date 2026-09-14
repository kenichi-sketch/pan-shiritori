/** 効果音（WebAudioで合成、音源ファイル不要）と読み上げ */
let ctx: AudioContext | null = null;
let enabled = true;
let speechEnabled = true;

export function setSoundEnabled(v: boolean): void { enabled = v; }
export function setSpeechEnabled(v: boolean): void { speechEnabled = v; }

function ac(): AudioContext | null {
  if (!enabled) return null;
  try {
    ctx = ctx ?? new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.15): void {
  const c = ac(); if (!c) return;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + start); o.stop(c.currentTime + start + dur + 0.05);
}

export const sfx = {
  tap(): void { tone(660, 0, 0.08, 'triangle', 0.08); },
  place(): void { tone(523, 0, 0.1, 'triangle', 0.1); tone(784, 0.06, 0.12, 'triangle', 0.1); },
  back(): void { tone(392, 0, 0.1, 'triangle', 0.08); },
  good(): void { [523, 659, 784].forEach((f, i) => tone(f, i * 0.07, 0.15, 'triangle', 0.12)); },
  wrong(): void { tone(220, 0, 0.18, 'sine', 0.1); tone(196, 0.15, 0.25, 'sine', 0.1); },
  clear(): void { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.22, 'triangle', 0.12)); },
  unlock(): void { [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.1, 0.3, 'sine', 0.1)); },
  hint(): void { tone(880, 0, 0.1, 'sine', 0.08); tone(1100, 0.1, 0.1, 'sine', 0.08); },
};

let jaVoice: SpeechSynthesisVoice | null | undefined;
function pickVoice(): SpeechSynthesisVoice | null {
  if (jaVoice !== undefined) return jaVoice;
  const vs = speechSynthesis.getVoices().filter((v) => v.lang.startsWith('ja'));
  jaVoice = vs.find((v) => /Google|Kyoko|O-ren|Nanami|Ayumi|Haruka/i.test(v.name)) ?? vs[0] ?? null;
  return jaVoice;
}
if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.addEventListener('voiceschanged', () => { jaVoice = undefined; });
}

export function speak(text: string, rate = 0.9): void {
  if (!speechEnabled || typeof speechSynthesis === 'undefined' || !text) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP'; u.rate = rate; u.pitch = 1.1;
    const v = pickVoice(); if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch { /* 非対応 */ }
}
