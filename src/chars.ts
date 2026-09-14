/** パンの申し子 12体（パン占い https://panuranai.ak-base.com と同じ数秘で決まる） */
export interface Bread {
  no: string;
  name: string;
  kana: string;
  line: string; // 子ども向けの一言
}

export const BREADS: Record<string, Bread> = {
  '001': { no: '001', name: 'フランスパン', kana: 'ふらんすぱん', line: 'まっすぐすすむ リーダー' },
  '002': { no: '002', name: 'あんぱん', kana: 'あんぱん', line: 'やさしい おてつだいやさん' },
  '003': { no: '003', name: 'メロンパン', kana: 'めろんぱん', line: 'みんなをわらわせる おひさま' },
  '004': { no: '004', name: '食パン', kana: 'しょくぱん', line: 'まいにちがんばる しっかりやさん' },
  '005': { no: '005', name: 'クロワッサン', kana: 'くろわっさん', line: 'かぜのように じゆうなたびびと' },
  '006': { no: '006', name: 'ミルクパン', kana: 'みるくぱん', line: 'ふんわりあったかい おせわやさん' },
  '007': { no: '007', name: 'カンパーニュ', kana: 'かんぱーにゅ', line: 'もりの しずかなかしこいひと' },
  '008': { no: '008', name: 'デニッシュ', kana: 'でにっしゅ', line: 'きらきらかがやく がんばりやさん' },
  '009': { no: '009', name: '全粒粉パン', kana: 'ぜんりゅうふんぱん', line: 'みんなをつつむ だいちのこ' },
  '011': { no: '011', name: '塩パン', kana: 'しおぱん', line: 'ぴかっとひらめく ひらめきやさん' },
  '022': { no: '022', name: 'ブリオッシュ', kana: 'ぶりおっしゅ', line: 'おおきなゆめをみる ゆめみるこ' },
  '033': { no: '033', name: 'ベーグル', kana: 'べーぐる', line: 'なんにでもなれる ふしぎなこ' },
};

export const PANURANAI_URL = 'https://panuranai.ak-base.com';

/** 数秘（ライフパスナンバー）: 生年月日の数字を全部足し、11/22/33 で止まるか1桁になるまで足す */
export function lifePathNumber(birth: string): number {
  const digits = birth.replace(/\D/g, '');
  let total = 0;
  for (const d of digits) total += Number(d);
  const digitSum = (n: number) => String(n).split('').reduce((s, c) => s + Number(c), 0);
  while (total > 9 && total !== 11 && total !== 22 && total !== 33) total = digitSum(total);
  return total;
}

export function breadFor(birth: string): Bread {
  const n = lifePathNumber(birth);
  return BREADS[String(n).padStart(3, '0')] ?? BREADS['001'];
}

export function breadImage(no: string): string {
  return `${import.meta.env.BASE_URL}chars/${no}.webp`;
}
