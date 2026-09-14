import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { loadDictionary, type Dictionary } from './data';
import { createProfile, currentProfile, listProfiles, saveProfile, setCurrentProfile, todayStr } from './profile';
import { setSoundEnabled, setSpeechEnabled } from './audio';
import type { Category, Profile } from './types';
import { clear, h } from './ui/dom';
import { mountHome } from './ui/home';
import { mountNewProfile, mountProfiles } from './ui/profiles';
import { mountPlay, type PlayMode } from './ui/play';
import { mountZukan } from './ui/zukan';
import { mountParent, mountParentGate } from './ui/parent';
import { initAnalytics, trackScreen } from './analytics';

registerSW({ immediate: true });
initAnalytics();

const app = document.getElementById('app')!;
let dict: Dictionary;
let cleanup: (() => void) | null = null;

function go(fn: () => (() => void) | void): void {
  if (cleanup) { cleanup(); cleanup = null; }
  window.scrollTo(0, 0);
  const c = fn();
  if (typeof c === 'function') cleanup = c;
}

function applySettings(p: Profile): void {
  setSoundEnabled(p.settings.sound);
  setSpeechEnabled(p.settings.speech);
}

function showProfiles(): void {
  trackScreen('profiles');
  go(() => mountProfiles(app, (p) => { applySettings(p); showHome(p); }, () => showNewProfile()));
}

function showNewProfile(edit?: Profile): void {
  trackScreen(edit ? 'edit_profile' : 'new_profile');
  go(() => mountNewProfile(app, (p) => { applySettings(p); showHome(p); }, () => (edit ? showParent(edit) : showProfiles()), edit));
}

function showHome(p: Profile): void {
  trackScreen('home');
  go(() => mountHome(app, dict, p, {
    play: (cat, level) => showPlay(p, cat, level, 'normal'),
    daily: (cat, level) => showPlay(p, cat, level, 'daily'),
    score: (cat, level, count) => showPlay(p, cat, level, 'score', count),
    zukan: () => { trackScreen('zukan'); go(() => mountZukan(app, dict, p, () => showHome(p))); },
    parent: () => go(() => mountParentGate(app, () => showParent(p), () => showHome(p))),
    switchProfile: () => showProfiles(),
  }));
}

function showParent(p: Profile): void {
  trackScreen('parent');
  go(() => mountParent(app, dict, p, {
    back: () => showHome(p),
    editProfile: (target) => showNewProfile(target),
    afterDelete: () => { const cur = currentProfile(); cur ? showHome(cur) : showProfiles(); },
  }));
}

function showPlay(p: Profile, cat: Category, level: number, mode: PlayMode, count?: number): void {
  trackScreen('play', { mode, cat, level });
  go(() => mountPlay(app, { dict, profile: p, cat, level, mode, count, onExit: () => showHome(p) }));
}

async function boot(): Promise<void> {
  clear(app);
  app.appendChild(h('div', { class: 'screen center', style: { justifyContent: 'center' } },
    h('img', { src: `${import.meta.env.BASE_URL}chars/003.webp`, style: { width: '140px', margin: '0 auto', animation: 'breathe 1.5s ease-in-out infinite' } }),
    h('p', { class: 'sub' }, 'じゅんびちゅう…')));
  try {
    dict = await loadDictionary();
  } catch (e) {
    clear(app);
    app.appendChild(h('div', { class: 'screen center' }, h('p', null, 'データを よみこめませんでした。インターネットに つないで もういちど ひらいてね。'), h('button', { class: 'btn', onClick: () => location.reload() }, 'もういちど')));
    console.error(e);
    return;
  }
  // 撮影・デモ用: ?demo=home|play|clear で、デモ用プロフィールを作って該当画面を開く
  const demo = new URLSearchParams(location.search).get('demo');
  if (demo) {
    let p = listProfiles().find((x) => x.name === 'ぱん' && x.birth === '2019-04-02');
    if (!p) {
      p = createProfile('ぱん', '2019-04-02');
      p.progress.stamps = 12; p.progress.streak = 3; p.progress.clears = { 1: 3, 2: 3, 3: 2 };
      for (const w of ['学校', '校長', '長女', '天気', '気力', '花火', '青空', '大人']) p.progress.collected[w] = todayStr();
      saveProfile(p);
    }
    setCurrentProfile(p.id);
    applySettings(p);
    if (demo === 'play') return showPlay(p, 1, 3, 'normal');
    if (demo === 'clear') return go(() => mountPlay(app, { dict, profile: p, cat: 1, level: 3, mode: 'normal', autoSolve: true, onExit: () => showHome(p) }));
    return showHome(p);
  }

  const cur = currentProfile();
  if (cur) { applySettings(cur); showHome(cur); }
  else if (listProfiles().length) showProfiles();
  else showNewProfile();
}

void boot();
