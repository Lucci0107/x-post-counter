# 開発・検証状況

確認日: 2026-10-05（日本時間）

## 再開時の実状態

- ブランチ: `codex/fix-mobile-overflow`、追跡先: `origin/main`
- 開始時のHEAD: `c454e9ca75b9b40e346a2e8057c53a845dd02bd4`
- fetch後のリモートとの差分: ahead 0 / behind 0
- staged・unstagedの変更: なし。未追跡は `.netlify/state.json` のみ
- 構成: `index.html`、`favicon.svg`、`netlify.toml` の静的サイト。サーバー・DB・アプリ認証・ビルド工程はなし
- 既存本番: https://x-post-counter.netlify.app/
- 開始時のNetlify deploy: `6a419937e9f4f5299b27038e`、`ready`
- 本番HTMLとローカルの差分はNetlifyが挿入するホスティング説明コメントのみ。faviconは同一

過去の完了報告ではなく、ソース、fetch後のGit状態、Netlify情報、HTTP取得、実ブラウザの結果で判断した。

## 追加改善の再開時点

- ブランチ: `codex/fix-mobile-overflow`、追跡先: `origin/codex/fix-mobile-overflow`
- 再開時のHEAD: `3d94ec8`。作業ツリーはクリーンで、リモートとも一致
- 初回修正はcommit・push済み。既存のドラフトPR: https://github.com/Lucci0107/x-post-counter/pull/1
- 本番は初回確認時のdeployのまま。追加改善と並行して本番アップロードは行っていない

## 項目ごとの分類

| 項目 | 開始時 | 現在 | 根拠 |
| --- | --- | --- | --- |
| 既存実装・リモートとの同期 | CONFIRMED_COMPLETE | CONFIRMED_COMPLETE | 初回確認時にorigin/mainと一致。追加改善は初回修正済みの作業ブランチから継続 |
| カウンター・文字種比率・全文プレビュー | IMPLEMENTED_NEEDS_VALIDATION | CONFIRMED_COMPLETE | 基本換算、入力更新、比率、全文表示を検証 |
| 定型文・画像・保存・コピー・クリア | IMPLEMENTED_NEEDS_VALIDATION | CONFIRMED_COMPLETE | ブラウザで主要操作と保存後の復元を検証 |
| スマートフォンの横はみ出し | FAILED | CONFIRMED_COMPLETE | 修正前は幅320〜390pxでscrollWidth 440px。修正後は10画面幅すべて画面幅以内 |
| 複合絵文字のX換算と省略 | FAILED | CONFIRMED_COMPLETE | 家族絵文字を7文字と数えていた問題を修正。複合絵文字、濁点、140文字境界をテスト |
| Xリンクの誤った失敗表示 | FAILED | CONFIRMED_COMPLETE | 実際には新規タブが開いても失敗表示だった。標準リンクに変更し、空入力・新規タブ・opener隔離を確認 |
| 入力直下の文字数・残り文字数と定型文折りたたみ | NOT_STARTED | CONFIRMED_COMPLETE | 残数・超過表示、入力欄との配置、キーボード開閉、スマートフォン表示を確認 |
| 公式ルールの文字数・URL判定 | NOT_STARTED | CONFIRMED_COMPLETE | 同梱twitter-textで換算。URL直後の日本語・句読点、ドメイン、記号、NFC正規化、140文字境界を検証 |
| クリア・空白削除の取り消し | NOT_STARTED | CONFIRMED_COMPLETE | 本文・選択範囲・画像・下書きの復元と新しい入力後の無効化を検証 |
| 保存失敗時の操作継続 | NOT_STARTED | CONFIRMED_COMPLETE | ストレージへのアクセス・読み取り・容量不足で、案内・編集・計算・コピー・取り消し・テーマ・定型文を検証 |
| 自動回帰テスト | NOT_STARTED | CONFIRMED_COMPLETE | `npm test`、29件成功 |
| 実ブラウザ検証 | IMPLEMENTED_NEEDS_VALIDATION | CONFIRMED_COMPLETE | Chromiumで55項目成功。320〜1280pxの10幅、ライト・ダークの画面確認 |
| GitHub Actions | NOT_STARTED | IMPLEMENTED_NEEDS_VALIDATION | Node.js 20 / 24で回帰テストと配信用ライブラリの再現性を確認するワークフローを追加。push後の実行結果を確認する |
| 既存の本番配信 | CONFIRMED_COMPLETE | CONFIRMED_COMPLETE | HTML・faviconともHTTP 200、既存deployはready |
| 今回の修正版の本番公開 | NOT_STARTED | BLOCKED | 自動承認審査が、具体的な本番反映の明示承認不足としてアップロードを拒否。反映時はHTML・favicon・vendorを含める |
| 今回の修正版の本番QA | NOT_STARTED | BLOCKED | 本番反映の承認・完了後に実施する |
| 途中の実装・未保存作業の引継ぎ | NOT_APPLICABLE | NOT_APPLICABLE | 開始時に未commitの実装変更はなかった |
| lint・型検査・本番ビルド | NOT_APPLICABLE | NOT_APPLICABLE | 専用設定・工程なし。HTML内JSはテストで評価し、差分の空白エラーも確認。通常の配信ビルドは不要 |
| API・DB・アプリ認証・migration | NOT_APPLICABLE | NOT_APPLICABLE | 静的サイトのため対象外 |

## 今回の変更

- タイムラインの操作列を折り返し、狭い画面の横はみ出しを解消
- `Intl.Segmenter` と公式 `twitter-text` で複合絵文字を換算し、タイムラインの途中で分断しない
- CRLF・CRも改行1個として換算。公式ルールの導入により半角カタカナ・濁点も日本語の重みで計算し、`ｶﾞﾊﾟ` はX換算4
- Xボタンを `noopener noreferrer` 付きの標準リンクに変更。本文はコピーしてX側で貼り付ける
- `.netlify/`・環境ファイル・依存フォルダーをGit管理から除外
- 実装に合わせてREADMEを更新し、回帰テストを追加
- X換算・残り文字数を入力欄直下へ移動し、定型文を折りたたみ。スマートフォンの入力欄を短くしてスクロールを削減
- URLの検出と省略を公式ルールに統一。配信用ライブラリ約30KBとライセンスをリポジトリへ同梱
- クリア・空白削除1回分の取り消しを追加。クリア時は画像も復元でき、新しい編集後は履歴を無効にする
- 保存エラーを扱う関数にアクセスを集約。画面内の値を保持し、保存不可でも主要操作を継続する
- GitHub Actionsに回帰テストと配信用ライブラリの再現性チェックを追加

## 検証の範囲と次の工程

回帰テスト29件、ローカルのブラウザ55項目、半角カタカナの追加ブラウザ確認、ライト・ダークの描画を確認した。JavaScript実行時エラー・コンソールエラーはなかった。Safari実機やXへの実際の投稿は実施していない。Xリンクは外部投稿画面への遷移先と新規タブの動作を検証し、投稿自体は行っていない。

承認後は既存Netlifyサイトへ修正版をアップロードし、HTML・favicon・配信用ライブラリとライセンスの配信内容、HTTP応答、本番の主要操作、モバイル表示を確認する。新しいサイトや別の配信方式は作らない。
