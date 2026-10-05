const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

// 実際のHTML内のスクリプトを読み込み、DOMに依存しない計算を検証する。
const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const elements = new Map();
const storage = new Map();
function createElement() {
  return {
    value: '', textContent: '', className: '', innerHTML: '',
    classList: { toggle() {}, add() {}, remove() {} },
    setAttribute() {}, removeAttribute() {}, addEventListener() {}
  };
}
const runtime = vm.createContext({
  Intl,
  document: {
    body: createElement(),
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createElement());
      return elements.get(id);
    }
  },
  localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key)
  },
  setTimeout: () => 0,
  clearTimeout() {}
});
vm.runInContext(script, runtime, { filename: 'index.html' });

test('既存の半角・全角・改行・URLの換算を維持する', () => {
  for (const [text, expected] of [
    ['', 0], ['ABC', 1.5], ['日本語', 3], ['ｶﾀｶﾅ', 2],
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

test('半角カタカナの濁点を全角・絵文字に含めない', () => {
  const metrics = runtime.getTweetMetrics('ｶﾞﾊﾟ');
  assert.equal(metrics.weighted, 2);
  assert.equal(metrics.specialWeight, 0);
  assert.equal(metrics.specialChars, 0);
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
  const prefix = `${'あ'.repeat(128)}A`;
  const url = 'https://example.com/very/long/path';
  const result = runtime.truncateSingleBlock(`${prefix}${url}\nB`);
  assert.equal(result.text, `${prefix}${url}`);
  assert.equal(result.truncated, true);
  assert.equal(runtime.getTweetMetrics(result.text).weighted, 140);
  assert.equal(runtime.truncateSingleBlock(`${'あ'.repeat(129)}${url}`).text, 'あ'.repeat(129));
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
