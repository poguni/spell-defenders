// 짧은 효과음(Web Audio API). 소리 파일 없이 음을 만들어 낸다.

export type SoundName = 'select' | 'correct' | 'wrong' | 'arrive';

let context: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !window.AudioContext) return null;
  context ??= new window.AudioContext();
  // 브라우저는 사용자가 화면을 누르기 전에는 소리를 막아 둔다. 누른 뒤 부르면 풀린다
  if (context.state === 'suspended') void context.resume();
  return context;
}

/** 음 하나: start초 뒤에 duration초 동안 */
function note(ctx: AudioContext, frequency: number, start: number, duration: number, type: OscillatorType, volume: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const at = ctx.currentTime + start;
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, at);
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(volume, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

export function playSound(name: SoundName) {
  if (!enabled) return;
  try {
    const ctx = audio();
    if (!ctx) return;
    switch (name) {
      case 'select': // 톡
        note(ctx, 660, 0, 0.08, 'triangle', 0.12);
        break;
      case 'correct': // 정화: 올라가는 반짝임
        [523, 659, 784, 1047].forEach((f, i) => note(ctx, f, i * 0.07, 0.25, 'sine', 0.14));
        break;
      case 'wrong': // 내려가는 두 음
        note(ctx, 330, 0, 0.18, 'square', 0.06);
        note(ctx, 247, 0.16, 0.28, 'square', 0.06);
        break;
      case 'arrive': // 성벽에 쿵
        note(ctx, 110, 0, 0.3, 'sawtooth', 0.08);
        break;
    }
  } catch {
    // 소리를 낼 수 없어도 게임은 계속한다
  }
}
