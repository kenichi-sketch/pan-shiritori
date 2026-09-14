# パンしりとり（漢字熟語しりとり）

小学生向けの漢字学習アプリ。隣り合う2枚が二字熟語になるように漢字タイルを一列に並べる「漢字しりとり」パズルです。
常用漢字2136字を小1〜中3の配当学年で7カテゴリに分け、レベル1〜5（3枚〜8枚）で遊びます。
相棒キャラクターは [パン占い](https://panuranai.ak-base.com) の「パンの申し子」12体。生年月日から学年と申し子が決まります。

要件の詳細は [要件定義書.md](要件定義書.md) を参照。作った経緯は [note の記事](https://note.com/mare_inc/n/nf1997b4e2f0f) に。

## 構成

- `src/` Vite + TypeScript のフロントエンド（サーバー不要、PWA）
- `public/data/dict.json` 漢字の学年・読みと、子ども向けに選別した二字熟語（`scripts/build_data.py` で生成）
- `public/chars/` パンの申し子（透過 WebP）
- `scripts/feasibility.py` JMdict / KANJIDIC2 から候補語を抽出して連鎖数を数える
- `scripts/build_data.py` 候補語 + Claude の判定 (`data/work/tags/`) + 上書き (`data/work/overrides.json`) から辞書 JSON を生成
- `docs/gas/` 「へんなことば」報告を Google スプレッドシートに集める Apps Script と手順

## 開発

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/ に出力（tsc の型チェック込み）
```

辞書を作り直すとき（`data/raw/` に JMdict_e.xml と kanjidic2.xml が必要）:

```bash
python scripts/feasibility.py   # 候補語の抽出
python scripts/build_data.py    # dict.json の生成
```

## 公開

`main` ブランチに push すると GitHub Actions が GitHub Pages にデプロイします（`.github/workflows/deploy.yml`）。

## データの出典とライセンス

- 漢字の学年: 文部科学省 学年別漢字配当表（[KANJIDIC2](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project) 経由）
- 熟語と読み: [JMdict](https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project)
- JMdict / KANJIDIC2 は Electronic Dictionary Research and Development Group の著作物で、[CC BY-SA 4.0](https://www.edrdg.org/edrdg/licence.html) に基づき利用しています。
- 子ども向けの選別と意味文は Claude で生成し、`data/work/overrides.json` で手動修正できます。

## プライバシー

プロフィール（名前・生年月日）、進捗、スコアはすべて端末内（localStorage）にのみ保存され、サーバーには送られません。
「へんなことば」報告だけは、保護者が設定した Apps Script の URL に熟語と学年を送ります。
