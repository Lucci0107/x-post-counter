const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createRuntime } = require('./helpers/runtime.cjs');

test('空白削除を取り消すと本文・選択範囲・保存内容を復元する', () => {
  const { runtime, elements, storage } = createRuntime();
  const input = elements.get('postText');
  input.value = 'A B\n日本語';
  input.setSelectionRange(2, 4);
  runtime.formatText();
  assert.equal(input.value, 'AB日本語');
  assert.equal(elements.get('undoBtn').disabled, false);
  runtime.undoLastAction();
  assert.equal(input.value, 'A B\n日本語');
  assert.equal(input.selectionStart, 2);
  assert.equal(input.selectionEnd, 4);
  assert.equal(elements.get('undoBtn').disabled, true);
  assert.equal(JSON.parse(storage.get('xCounterDraft')).text, input.value);
});

test('クリアを取り消すと本文と画像を復元する', () => {
  const { runtime, elements } = createRuntime();
  const file = { type: 'image/png', name: '確認用.png' };
  runtime.setImagePreview(file);
  elements.get('postText').value = '画像付きの本文';
  runtime.clearText();
  assert.equal(elements.get('postText').value, '');
  assert.equal(elements.get('imagePreview').classList.contains('show'), false);
  runtime.undoLastAction();
  assert.equal(elements.get('postText').value, '画像付きの本文');
  assert.equal(elements.get('imageName').textContent, '確認用.png');
  assert.equal(elements.get('imagePreview').classList.contains('show'), true);
});

test('変化のない空白削除・二度目のクリアは取り消し履歴を上書きしない', () => {
  const { runtime, elements } = createRuntime();
  elements.get('postText').value = ' A';
  runtime.formatText();
  runtime.formatText();
  runtime.undoLastAction();
  assert.equal(elements.get('postText').value, ' A');
  runtime.clearText();
  runtime.clearText();
  runtime.undoLastAction();
  assert.equal(elements.get('postText').value, ' A');
});

test('新しい入力後は古い操作で本文を上書きしない', () => {
  const { runtime, elements } = createRuntime();
  elements.get('postText').value = '古い本文';
  runtime.clearText();
  elements.get('postText').value = '新しい本文';
  elements.get('postText').dispatch('input');
  assert.equal(elements.get('undoBtn').disabled, true);
  runtime.undoLastAction();
  assert.equal(elements.get('postText').value, '新しい本文');
});

for (const failure of ['failAccess', 'failReads', 'failWrites']) {
  test(`${failure}でも初期表示・編集・コピー・テーマ変更を続けられる`, async () => {
    const { runtime, elements } = createRuntime({ [failure]: true });
    assert.equal(elements.get('weightedCount').textContent, '0');
    assert.equal(elements.get('storageNotice').hidden, false);
    elements.get('postText').value = '確認用の本文';
    runtime.update();
    assert.equal(elements.get('detailBody').textContent, '確認用の本文');
    await runtime.copyText();
    assert.equal(elements.get('toast').textContent, '投稿文をコピーしました');
    runtime.toggleTheme();
    assert.equal(elements.get('themeBtn').textContent, 'ライトモード');
  });
}

test('保存容量不足でも既存の下書きを復元し、画面内の変更は保持する', () => {
  const { runtime, elements, storage } = createRuntime({ failWrites: true, savedValues: { xCounterDraft: '{"text":"保存済み"}' } });
  assert.equal(elements.get('postText').value, '保存済み');
  elements.get('postText').value = '編集中の本文';
  runtime.update();
  runtime.restoreDraft();
  assert.equal(elements.get('postText').value, '編集中の本文');
  assert.equal(JSON.parse(storage.get('xCounterDraft')).text, '保存済み');
});

test('保存できなくても定型文の削除を画面内で保持する', () => {
  const { runtime } = createRuntime({ failWrites: true });
  runtime.deleteTemplate('ai');
  assert.ok(!runtime.loadTemplates().some(item => item.id === 'ai'));
  assert.ok(runtime.loadDeletedDefaultTemplateIds().has('ai'));
});

test('破損データの削除にも失敗する環境で初期化を続けられる', () => {
  const { runtime, elements } = createRuntime({ failRemovals: true, savedValues: { xCounterTemplates: '{invalid', xCounterDeletedDefaultTemplates: '{invalid', xCounterDraft: '{"text":42}' } });
  assert.equal(runtime.loadTemplates().length, 7);
  assert.equal(elements.get('postText').value, '');
  assert.equal(elements.get('storageNotice').hidden, false);
  assert.equal(runtime.readStoredValue('xCounterTemplates'), null);
});
