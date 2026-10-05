const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createRuntime, twitterText } = require('./helpers/runtime.cjs');
const { runtime, elements } = createRuntime();

test('基本文字・改行・URLを140文字基準で換算する', () => {
  for (const [text, expected] of [
    ['', 0], ['ABC', 1.5], ['日本語', 3], ['ｶﾀｶﾅ', 4],
    ['ABC\nあ', 3], ['https://example.com', 11.5],
    ['https://example.com https://example.org/long/path', 23.5]
  ]) {
    assert.equal(runtime.getTweetMetrics(text).weighted, expected, text);
  }
});

for (const emoji of ['😀', '👍🏽', '👨‍👩‍👧‍👦', '🇯🇵', '1️⃣', '❤️', '👩🏽‍💻', '🏳️‍🌈']) {
  test(`複合絵文字 ${emoji} をX換算1文字として数える`, () => {
    const metrics = runtime.getTweetMetrics(emoji);
    assert.equal(metrics.weighted, 1);
    assert.equal(metrics.specialWeight, 1);
    assert.equal(metrics.specialChars, 1);
  });
}

test('改行コードの違いでX換算が増えない', () => {
  for (const separator of ['\n', '\r\n', '\r']) {
    const metrics = runtime.getTweetMetrics(`あ${separator}い`);
    assert.equal(metrics.weighted, 2.5);
    assert.equal(metrics.lineBreaks, 1);
    assert.equal(metrics.specialWeight, 2);
  }
});

test('半角カタカナと濁点もX公式の日本語の重みで計算する', () => {
  const metrics = runtime.getTweetMetrics('ｶﾞﾊﾟ');
  assert.equal(metrics.weighted, 4);
  assert.equal(metrics.specialWeight, 4);
  assert.equal(metrics.raw, 4);
});

test('入力文字数と文字種比率は元のコードポイント数を保つ', () => {
  const text = '漢あアAＡ👍🏽';
  const metrics = runtime.getTweetMetrics(text);
  assert.equal(metrics.raw, 7);
  const types = runtime.countCharacterTypes(text);
  assert.equal(Object.values(types).reduce((sum, count) => sum + count, 0), metrics.raw);
  assert.equal(types.kanji, 1);
  assert.equal(types.other, 2);
});

test('タイムラインの140文字境界で複合絵文字を分断しない', () => {
  const text = `${'あ'.repeat(139)}👨‍👩‍👧‍👦👍🏽`;
  const result = runtime.truncateSingleBlock(text);
  assert.equal(result.text, `${'あ'.repeat(139)}👨‍👩‍👧‍👦`);
  assert.equal(result.truncated, true);
  assert.equal(runtime.getTweetMetrics(result.text).weighted, 140);
  assert.equal(runtime.truncateSingleBlock('あ'.repeat(140)).truncated, false);
});

test('タイムラインでURLを途中で切らない', () => {
  const prefix = `${'あ'.repeat(128)}\n`;
  const url = 'https://example.com/very/long/path';
  const result = runtime.truncateSingleBlock(`${prefix}${url}\nB`);
  assert.equal(result.text, `${prefix}${url}`);
  assert.equal(result.truncated, true);
  assert.equal(runtime.getTweetMetrics(result.text).weighted, 140);
  assert.equal(runtime.truncateSingleBlock(`${'あ'.repeat(129)}${url}`).text, 'あ'.repeat(129));
});

test('URL直後の日本語・句読点と括弧を本文として数える', () => {
  for (const [text, expected] of [
    ['https://example.com日本語。', 15.5],
    ['https://example.com/path).', 12.5],
    ['(https://example.com)', 12.5],
    ['example.com', 11.5],
    ['https://', 4],
    ['https://example.com/a(1)', 11.5]
  ]) assert.equal(runtime.getTweetMetrics(text).weighted, expected, text);
  assert.deepEqual(Array.from(runtime.linkMatches('https://example.com日本語。')), ['https://example.com']);
});

test('アクセント文字はNFC正規化し、X公式の重みで計算する', () => {
  assert.equal(runtime.getTweetMetrics('café').weighted, 2);
  assert.equal(runtime.getTweetMetrics('cafe\u0301').weighted, 2);
  assert.equal(runtime.getTweetMetrics('cafe\u0301').raw, 5);
});

test('混在文の計算とタイムラインの切り取りが公式の重みと一致する', () => {
  for (const text of [
    '詳しくはhttps://example.comをご覧ください。',
    '👩🏽‍💻 café ｶﾞ\nexample.com/path).',
    '— “記号” ＡＢＣ\t123',
    'a\u0301\u0327 日本語 👍🏽',
    `${'あ'.repeat(127)}👨‍👩‍👧‍👦\nhttps://example.com日本語。`
  ]) {
    assert.equal(runtime.getTweetMetrics(text).weighted, twitterText.parseTweet(text).weightedLength / 2, text);
    const preview = runtime.truncateSingleBlock(text);
    assert.ok(twitterText.parseTweet(preview.text).weightedLength / 2 <= 140);
  }
});

test('残り文字数・超過文字数と警告色が入力に追従する', () => {
  const { runtime: app, elements: ui } = createRuntime();
  for (const [text, label, remaining, over] of [
    ['', '残り文字数', '140', false],
    ['ABC', '残り文字数', '138.5', false],
    ['あ'.repeat(140), '残り文字数', '0', false],
    [`${'あ'.repeat(140)}A`, '超過文字数', '0.5', true]
  ]) {
    ui.get('postText').value = text;
    app.update();
    assert.equal(ui.get('remainingLabel').textContent, label);
    assert.equal(ui.get('remainingCount').textContent, remaining);
    assert.equal(ui.get('weightedCount').classList.contains('over'), over);
    assert.equal(ui.get('remainingCount').classList.contains('over'), over);
  }
});

test('Xリンクは空の本文を止め、入力済みなら遷移を許可する', () => {
  let prevented = false;
  const event = { preventDefault() { prevented = true; } };
  elements.get('postText').value = '  ';
  runtime.postToX(event);
  assert.equal(prevented, true);
  assert.equal(elements.get('toast').textContent, 'Xに投稿する本文を入力してください');
  prevented = false;
  elements.get('postText').value = '投稿文';
  runtime.postToX(event);
  assert.equal(prevented, false);
  assert.match(elements.get('toast').textContent, /新しいタブで開きます/);
});
