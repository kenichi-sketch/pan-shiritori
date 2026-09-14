import { BREADS, breadImage } from '../chars';
import { h } from './dom';

export type Mood = 'idle' | 'happy' | 'sad' | 'dance' | 'think' | 'wave';

/**
 * 画面に出る相棒キャラクター。1枚絵をCSSで動かす。
 * idle: ゆっくり呼吸 + ときどきぴょこん / happy: ジャンプ / sad: 首かしげ / dance: おどる
 */
export class Character {
  readonly el: HTMLElement;
  private img: HTMLImageElement;
  private hopTimer: number | null = null;
  private moodTimer: number | null = null;

  constructor(no: string, size = 140) {
    const b = BREADS[no] ?? BREADS['001'];
    this.img = h('img', { src: breadImage(b.no), alt: b.name, draggable: false, class: 'char-img' });
    this.el = h('div', { class: 'char idle', style: { width: `${size}px`, height: `${size}px` } }, this.img, h('div', { class: 'char-shadow' }));
    this.startIdle();
  }

  private startIdle(): void {
    this.stopIdle();
    const hop = () => {
      if (this.el.classList.contains('idle')) {
        this.el.classList.add('hop');
        window.setTimeout(() => this.el.classList.remove('hop'), 700);
      }
      this.hopTimer = window.setTimeout(hop, 3500 + Math.random() * 4000);
    };
    this.hopTimer = window.setTimeout(hop, 2000 + Math.random() * 2000);
  }
  private stopIdle(): void {
    if (this.hopTimer) { clearTimeout(this.hopTimer); this.hopTimer = null; }
  }

  /** 一時的な気分。duration 後に idle に戻る（0 なら戻らない） */
  mood(m: Mood, duration = 1200): void {
    if (this.moodTimer) { clearTimeout(this.moodTimer); this.moodTimer = null; }
    this.el.classList.remove('idle', 'happy', 'sad', 'dance', 'think', 'wave', 'hop');
    // 再トリガーのためリフロー
    void this.el.offsetWidth;
    this.el.classList.add(m);
    if (m !== 'idle' && duration > 0) {
      this.moodTimer = window.setTimeout(() => this.mood('idle', 0), duration);
    }
  }

  setBread(no: string): void {
    const b = BREADS[no] ?? BREADS['001'];
    this.img.src = breadImage(b.no); this.img.alt = b.name;
  }

  destroy(): void {
    this.stopIdle();
    if (this.moodTimer) clearTimeout(this.moodTimer);
  }
}

/** 紙吹雪 */
export function confetti(container: HTMLElement, count = 40): void {
  const colors = ['#f4a261', '#e76f51', '#2a9d8f', '#e9c46a', '#8ecae6', '#ffb4a2', '#b5e48c'];
  for (let i = 0; i < count; i++) {
    const p = h('span', { class: 'confetti', style: {
      left: `${Math.random() * 100}%`,
      background: colors[i % colors.length],
      animationDelay: `${Math.random() * 0.8}s`,
      animationDuration: `${1.8 + Math.random() * 1.2}s`,
      transform: `rotate(${Math.random() * 360}deg)`,
      width: `${8 + Math.random() * 8}px`,
      height: `${10 + Math.random() * 10}px`,
    } });
    container.appendChild(p);
    window.setTimeout(() => p.remove(), 3200);
  }
}
