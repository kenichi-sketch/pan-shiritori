/**
 * パンしりとり「へんなことば」報告の受け口（Google Apps Script）
 *
 * 使い方は同じフォルダの README.md を参照。
 * アプリから POST された JSON を、このスクリプトに紐づくスプレッドシートの「reports」シートに1行追加します。
 *
 * いたずら対策:
 *  - 熟語は漢字2文字、読みはひらがな・カタカナ12文字以内でなければ捨てる
 *  - 1日の受付は MAX_PER_DAY 行まで
 *  - 同じ熟語が既に記録されていれば行を増やさず「回数」を +1 する
 */
var MAX_PER_DAY = 200;

function doPost(e) {
  try {
    var body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    var word = String(body.word || '');
    var reading = String(body.reading || '');
    if (!/^[一-鿿]{2}$/.test(word)) return json_({ ok: false, error: 'bad word' });
    if (!/^[぀-ヿー]{1,12}$/.test(reading)) return json_({ ok: false, error: 'bad reading' });

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('reports') || ss.insertSheet('reports');
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['受信日時', '熟語', '読み', 'カテゴリ', '学年', 'アプリ側日時', '回数']);
    }
    var catLabel = { 1: '小1まで', 2: '小2まで', 3: '小3まで', 4: '小4まで', 5: '小5まで', 6: '小6まで', 8: '中3まで' };
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      var values = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
      var today = new Date(); today.setHours(0, 0, 0, 0);
      var todayCount = 0;
      for (var i = 0; i < values.length; i++) {
        if (values[i][1] === word) {
          sheet.getRange(i + 2, 7).setValue(Number(values[i][6] || 1) + 1);
          return json_({ ok: true, dup: true });
        }
        if (values[i][0] instanceof Date && values[i][0] >= today) todayCount++;
      }
      if (todayCount >= MAX_PER_DAY) return json_({ ok: false, error: 'daily limit' });
    }
    sheet.appendRow([
      new Date(), word, reading,
      catLabel[body.cat] || String(body.cat || ''),
      body.grade != null ? Number(body.grade) : '',
      String(body.at || ''),
      1,
    ]);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** 動作確認用（ブラウザで URL を開くと表示される） */
function doGet() {
  return ContentService.createTextOutput('panshiri report endpoint OK');
}
