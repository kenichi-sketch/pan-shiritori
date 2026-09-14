import type { Dictionary } from '../data';
import { PANURANAI_URL } from '../chars';
import { autoCap, deleteProfile, gradeLabel, listProfiles, loadSettings, saveProfile, saveSettings, schoolGrade } from '../profile';
import { bestsFor } from '../ranking';
import { setSoundEnabled, setSpeechEnabled, sfx } from '../audio';
import type { Category, Profile } from '../types';
import { CATEGORIES, CATEGORY_LABEL_KANJI } from '../types';
import { clear, h } from './dom';

export interface ParentActions {
  back: () => void;
  editProfile: (p: Profile) => void;
  afterDelete: () => void;
}

/** 子どもが入りにくいように簡単な計算ゲート */
export function mountParentGate(root: HTMLElement, onPass: () => void, onBack: () => void): void {
  const a = 3 + Math.floor(Math.random() * 6), b = 3 + Math.floor(Math.random() * 6);
  const input = h('input', { type: 'number', inputmode: 'numeric', placeholder: 'こたえ', style: { fontSize: '1.4rem', width: '8em' } });
  const err = h('div', { style: { color: '#e76f51', minHeight: '1.5em' } });
  const check = () => { if (Number(input.value) === a * b) onPass(); else { err.textContent = 'ちがいます'; sfx.wrong(); } };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') check(); });
  clear(root);
  root.appendChild(h('div', { class: 'screen' },
    h('div', { class: 'topbar' }, h('button', { class: 'icon-btn', onClick: onBack }, '←'), h('h1', { class: 'title' }, 'おうちのひと メニュー')),
    h('div', { class: 'card form' },
      h('p', null, '保護者の方向けの設定です。次の計算の答えを入れてください。'),
      h('div', { class: 'row' }, h('span', { style: { fontSize: '1.6rem', fontWeight: '900' } }, `${a} × ${b} = `), input, h('button', { class: 'btn', onClick: check }, 'OK')),
      err,
    ),
  ));
  window.setTimeout(() => input.focus(), 100);
}

export function mountParent(root: HTMLElement, dict: Dictionary, current: Profile, act: ParentActions): void {
  const settings = loadSettings();
  const profiles = listProfiles();

  function toggle(label: string, get: () => boolean, set: (v: boolean) => void): HTMLElement {
    const sw = h('button', { class: `switch ${get() ? 'on' : ''}`, onClick: () => { set(!get()); sw.classList.toggle('on', get()); } });
    return h('div', { class: 'toggle' }, h('span', null, label), sw);
  }

  function profileCard(p: Profile): HTMLElement {
    const grade = schoolGrade(p.birth);
    const auto = autoCap(p);
    const capSel = h('select', null,
      h('option', { value: '', selected: !p.manualCap }, `自動（いま: ${CATEGORY_LABEL_KANJI[auto]}）`),
      ...CATEGORIES.map((c) => h('option', { value: String(c), selected: p.manualCap === c }, `${CATEGORY_LABEL_KANJI[c]}まで開く`)),
    );
    capSel.addEventListener('change', () => { p.manualCap = capSel.value ? (Number(capSel.value) as Category) : null; saveProfile(p); });
    const bests = bestsFor(p.id);
    const stats = p.progress;
    return h('div', { class: 'card' },
      h('h3', null, `${p.name}（${gradeLabel(grade)}・生年月日 ${p.birth}）`),
      h('table', null,
        h('tr', null, h('th', null, 'クリア数'), h('td', null, String(stats.totalPuzzles)), h('th', null, 'スタンプ'), h('td', null, String(stats.stamps))),
        h('tr', null, h('th', null, '連続日数'), h('td', null, String(stats.streak)), h('th', null, 'ヒント使用'), h('td', null, String(stats.hintsUsed))),
        h('tr', null, h('th', null, '集めた熟語'), h('td', null, String(Object.keys(stats.collected).length)), h('th', null, 'レベル別クリア'), h('td', null, [1, 2, 3, 4, 5].map((l) => `L${l}:${stats.clears[l] ?? 0}`).join(' '))),
      ),
      bests.length ? h('div', { style: { marginTop: '8px' } }, h('strong', null, 'スコアアタック最高点: '), bests.map((b) => `${CATEGORY_LABEL_KANJI[b.cat]} L${b.level} ${b.count}問 ${b.score}点`).join(' ／ ')) : null,
      h('div', { class: 'row', style: { marginTop: '10px' } }, h('span', null, '出題範囲の上限'), capSel),
      toggle('タイルにふりがなを表示', () => p.settings.furigana, (v) => { p.settings.furigana = v; saveProfile(p); }),
      toggle('効果音', () => p.settings.sound, (v) => { p.settings.sound = v; saveProfile(p); if (p.id === current.id) setSoundEnabled(v); }),
      toggle('読み上げ', () => p.settings.speech, (v) => { p.settings.speech = v; saveProfile(p); if (p.id === current.id) setSpeechEnabled(v); }),
      h('div', { class: 'row', style: { marginTop: '10px' } },
        h('button', { class: 'btn small ghost', onClick: () => act.editProfile(p) }, '名前・生年月日を直す'),
        h('button', { class: 'btn small ghost', style: { color: '#e76f51' }, onClick: () => {
          if (confirm(`${p.name} のプロフィールと進捗を削除します。元に戻せません。よろしいですか？`)) { deleteProfile(p.id); act.afterDelete(); }
        } }, '削除'),
      ),
    );
  }

  const urlInput = h('input', { type: 'url', value: settings.reportUrl, placeholder: 'https://script.google.com/macros/s/…/exec', style: { width: '100%' } });
  urlInput.addEventListener('change', () => { settings.reportUrl = urlInput.value.trim(); saveSettings(settings); });

  const reportsEl = h('div', null);
  function renderReports(): void {
    clear(reportsEl);
    if (!settings.reports.length) { reportsEl.appendChild(h('p', { class: 'sub' }, 'まだ報告はありません。')); return; }
    reportsEl.appendChild(h('table', null,
      h('tr', null, h('th', null, '熟語'), h('th', null, '読み'), h('th', null, 'カテゴリ'), h('th', null, '日時'), h('th', null, '送信')),
      ...settings.reports.slice(0, 50).map((r) => h('tr', null,
        h('td', null, r.word), h('td', null, r.reading), h('td', null, CATEGORY_LABEL_KANJI[r.cat]), h('td', null, r.at.slice(0, 16).replace('T', ' ')), h('td', null, r.sent ? '済' : '未'))),
    ));
    reportsEl.appendChild(h('div', { class: 'row', style: { marginTop: '8px' } },
      h('button', { class: 'btn small ghost', onClick: async () => {
        const text = settings.reports.map((r) => `${r.word}\t${r.reading}\t${CATEGORY_LABEL_KANJI[r.cat]}\t${r.at}`).join('\n');
        try { await navigator.clipboard.writeText(text); alert('コピーしました'); } catch { alert('コピーできませんでした'); }
      } }, '一覧をコピー'),
      h('button', { class: 'btn small ghost', onClick: () => { if (confirm('報告一覧を消しますか？')) { settings.reports = []; saveSettings(settings); renderReports(); } } }, '一覧を消す'),
    ));
  }
  renderReports();

  clear(root);
  root.appendChild(h('div', { class: 'screen parent' },
    h('div', { class: 'topbar' }, h('button', { class: 'icon-btn', onClick: act.back }, '←'), h('h1', { class: 'title' }, 'おうちのひと メニュー')),
    ...profiles.map(profileCard),
    h('div', { class: 'card' },
      h('h3', null, '「へんなことば」報告の送り先（Google Apps Script の URL）'),
      h('p', { class: 'sub' }, 'クリア画面の 🚩 を押すと、ここに設定した URL に送られ、スプレッドシートに記録されます。空欄なら端末内に保存だけします。設定手順は docs/gas/README.md を参照。'),
      urlInput,
      h('h3', { style: { marginTop: '14px' } }, 'この端末に保存されている報告'),
      reportsEl,
    ),
    h('div', { class: 'card' },
      h('h3', null, 'データについて'),
      h('p', { class: 'credit' },
        `収録熟語 ${dict.words.size} 語。漢字の学年は文部科学省の学年別漢字配当表（KANJIDIC2 経由）、熟語と読みは JMdict を元に、子ども向けに選別しています。`, h('br'),
        'JMdict / KANJIDIC2 は ', h('a', { href: 'https://www.edrdg.org/', target: '_blank', rel: 'noopener' }, 'Electronic Dictionary Research and Development Group'), ' の著作物で、',
        h('a', { href: 'https://www.edrdg.org/edrdg/licence.html', target: '_blank', rel: 'noopener' }, 'CC BY-SA 4.0'), ' に基づき利用しています。', h('br'),
        'キャラクター「パンの申し子」は ', h('a', { href: PANURANAI_URL, target: '_blank', rel: 'noopener' }, 'パン占い'), ' より。'),
    ),
  ));
}
