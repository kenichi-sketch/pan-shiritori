import { BREADS, PANURANAI_URL, breadFor, breadImage } from '../chars';
import { createProfile, gradeLabel, listProfiles, saveProfile, schoolGrade, setCurrentProfile } from '../profile';
import type { Profile } from '../types';
import { sfx } from '../audio';
import { Character } from './character';
import { clear, h } from './dom';
import { openShareModal } from './share';

export function mountProfiles(root: HTMLElement, onSelect: (p: Profile) => void, onNew: () => void): void {
  const profiles = listProfiles();
  const grid = h('div', { class: 'profile-grid' },
    ...profiles.map((p) => h('div', { class: 'profile-card', onClick: () => { sfx.tap(); setCurrentProfile(p.id); onSelect(p); } },
      h('img', { src: breadImage(p.bread), alt: '' }),
      h('div', { class: 'name' }, p.name),
      h('div', { class: 'sub' }, gradeLabel(schoolGrade(p.birth))),
    )),
    h('div', { class: 'profile-card add', onClick: () => { sfx.tap(); onNew(); } }, h('div', null, h('div', { style: { fontSize: '2.4rem' } }, '＋'), 'あたらしく つくる')),
  );
  clear(root);
  root.appendChild(h('div', { class: 'screen' },
    h('div', { class: 'topbar' }, h('h1', { class: 'title' }, '🥐 パンしりとり')),
    h('p', { class: 'sub' }, profiles.length ? 'だれが あそぶ？' : 'まずは じぶんの プロフィールを つくろう'),
    grid,
    h('div', { class: 'home-footer' },
      h('span', { class: 'credit' }, 'キャラクターは ', h('a', { href: PANURANAI_URL, target: '_blank', rel: 'noopener' }, 'パン占い'), ' の「パンの申し子」たち'),
      h('button', { class: 'btn ghost small', onClick: () => { sfx.tap(); openShareModal(); } }, '👫 ともだちに おしえる（QR・URL）'),
    ),
  ));
}

export function mountNewProfile(root: HTMLElement, onDone: (p: Profile) => void, onCancel: () => void, edit?: Profile): void {
  const now = new Date();
  const years: number[] = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 20; y--) years.push(y);
  const [ey, em, ed] = edit ? edit.birth.split('-').map(Number) : [now.getFullYear() - 7, 4, 2];

  const nameInput = h('input', { type: 'text', maxlength: '10', placeholder: 'なまえ（ひらがなでも OK）', value: edit?.name ?? '', autocomplete: 'off' });
  const ySel = h('select', null, ...years.map((y) => h('option', { value: String(y), selected: y === ey }, `${y}ねん`)));
  const mSel = h('select', null, ...Array.from({ length: 12 }, (_, i) => h('option', { value: String(i + 1), selected: i + 1 === em }, `${i + 1}がつ`)));
  const dSel = h('select', null, ...Array.from({ length: 31 }, (_, i) => h('option', { value: String(i + 1), selected: i + 1 === ed }, `${i + 1}にち`)));
  const preview = h('div', { class: 'sub center' });
  const errEl = h('div', { style: { color: '#e76f51', fontWeight: '700', minHeight: '1.5em' } });

  function birth(): string {
    return `${ySel.value}-${String(mSel.value).padStart(2, '0')}-${String(dSel.value).padStart(2, '0')}`;
  }
  function updatePreview(): void {
    const g = schoolGrade(birth());
    preview.textContent = `いまは ${gradeLabel(g)}`;
  }
  [ySel, mSel, dSel].forEach((s) => s.addEventListener('change', updatePreview));
  updatePreview();

  function submit(): void {
    const name = nameInput.value.trim();
    if (!name) { errEl.textContent = 'なまえを いれてね'; nameInput.focus(); return; }
    const b = birth();
    const d = new Date(b);
    if (Number.isNaN(d.getTime()) || d.getDate() !== Number(dSel.value)) { errEl.textContent = 'その ひづけは ないみたい'; return; }
    let p: Profile;
    if (edit) {
      p = { ...edit, name, birth: b, bread: breadFor(b).no };
    } else {
      p = createProfile(name, b);
    }
    saveProfile(p);
    setCurrentProfile(p.id);
    sfx.good();
    showReveal(root, p, () => onDone(p));
  }

  clear(root);
  root.appendChild(h('div', { class: 'screen' },
    h('div', { class: 'topbar' },
      h('button', { class: 'icon-btn', onClick: onCancel, 'aria-label': 'もどる' }, '←'),
      h('h1', { class: 'title' }, edit ? 'プロフィールを なおす' : 'プロフィールを つくる'),
    ),
    // 何のために入れるのかが分かるように一言（2026-09-15 有澤さん指摘）
    h('p', { class: 'sub', style: { margin: '0 0 10px' } },
      edit ? 'なおすと、がくねんと あいぼうの パンも かわることが あります。'
           : 'なまえと たんじょうびを いれると、がくねんに あった かんじが でて、あいぼうの パンが きまるよ。あとから 「おうちのひと メニュー」で なおせます。'),
    h('div', { class: 'form card' },
      h('label', null, 'なまえ', nameInput),
      h('label', null, 'たんじょうび（がくねんと あいぼうの パンが きまるよ）',
        h('div', { class: 'date-row' }, ySel, mSel, dSel)),
      preview,
      errEl,
      h('button', { class: 'btn big green', onClick: submit }, edit ? 'ほぞんする' : 'けってい！'),
      h('p', { class: 'credit' }, 'なまえと たんじょうびは この たんまつの なかにだけ ほぞんされます。'),
    ),
  ));
  if (!edit) window.setTimeout(() => nameInput.focus(), 100);
}

function showReveal(root: HTMLElement, p: Profile, onDone: () => void): void {
  const b = BREADS[p.bread];
  const ch = new Character(p.bread, 220);
  ch.mood('dance', 2500);
  clear(root);
  root.appendChild(h('div', { class: 'screen' },
    h('div', { class: 'reveal', style: { marginTop: '5vh' } },
      h('div', { class: 'sub' }, `${p.name}の あいぼうは…`),
      ch.el,
      h('h2', { style: { margin: '6px 0 0', color: '#e76f51' } }, `${b.name}の もうしご！`),
      h('div', { class: 'bubble', style: { marginTop: '10px' } }, b.line),
      h('div', { class: 'sub', style: { marginTop: '6px' } }, gradeLabel(schoolGrade(p.birth))),
      h('button', { class: 'btn big', style: { marginTop: '20px' }, onClick: () => { ch.destroy(); onDone(); } }, 'よろしくね！ ▶'),
    ),
  ));
}
