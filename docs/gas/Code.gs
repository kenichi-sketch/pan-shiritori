/**
 * パンしりとり「へんなことば」報告の受け口（Google Apps Script）
 *
 * 使い方は同じフォルダの README.md を参照。
 * アプリから POST された JSON を、このスクリプトに紐づくスプレッドシートの「reports」シートに1行追加します。
 */
function doPost(e) {
  try {
    var body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('reports') || ss.insertSheet('reports');
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['受信日時', '熟語', '読み', 'カテゴリ', '学年', 'アプリ側日時']);
    }
    var catLabel = { 1: '小1まで', 2: '小2まで', 3: '小3まで', 4: '小4まで', 5: '小5まで', 6: '小6まで', 8: '中3まで' };
    sheet.appendRow([
      new Date(),
      String(body.word || ''),
      String(body.reading || ''),
      catLabel[body.cat] || String(body.cat || ''),
      body.grade != null ? Number(body.grade) : '',
      String(body.at || ''),
    ]);
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}

/** 動作確認用（ブラウザで URL を開くと表示される） */
function doGet() {
  return ContentService.createTextOutput('panshiri report endpoint OK');
}
