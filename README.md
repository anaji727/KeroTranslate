# 🐸KeroTranslate — Chrome Extension PoC 0.1

2026-10-06 / ローカル検証用。正式名称は未決。

YouTube Liveの音声字幕と、自分のコメントを Original → MTL → re-MTL で確認するChrome拡張です。**INSERTは純正入力欄へ挿入するだけ。投稿は本人がYouTubeで行います。**

## まず見る

[artifacts/KeroTranslate-Preview.html](artifacts/KeroTranslate-Preview.html) をダウンロードし、エクスプローラーからブラウザーで開いてください。単体HTMLなのでインストール不要です。GitHubのファイル閲覧画面ではHTMLは実行されません。

- 仮の配信画面、字幕表示3モード・9マス位置・1/2行を操作できます。
- Composerの `Try sample` で固定例文を読み込み、翻訳→再翻訳→INSERTを試せます。
- 下の入力欄は模擬YouTube入力欄です。投稿機能はありません。
- 既存下書きがあれば `Replace draft / Keep draft` を選びます。
- 例文以外を入力するとデモ限定の案内を出します。任意文章を翻訳したふりはしません。
- デモHTMLはAPI、YouTube、外部フォント等に接続しません。

## Chromeへ読み込む

1. Chrome 116以降で拡張機能管理画面を開き、デベロッパーモードを有効にします。
2. 「パッケージ化されていない拡張機能を読み込む」で、このフォルダーの **`extension`** を選びます。`manifest.json` が直下にあるフォルダーです。
3. 既に開いているYouTubeページを再読み込みします。
4. 拡張の `Settings & API keys` からProviderを指定します。初期値は両方Demoです。
5. 実翻訳はGemini、実音声認識はDeepgramを選択し、それぞれ自分のキーを設定します。キーをチャットへ貼り付ける必要はありません。
6. YouTube Liveの通常視聴画面を開き、拡張のツールバーポップアップで `Start captions` を押します。実音声は対象タブから取得します。マイクは使いません。
7. `Stop` で字幕用の音声取得・通信を停止します。Composerは独立して操作できます。

ZIP版は [artifacts/KeroTranslate-Extension.zip](artifacts/KeroTranslate-Extension.zip) にあります。ダウンロード・展開後、その中のmanifestがあるフォルダーを読み込んでください。

## 今回できたもの／まだ検証していないもの

| 項目 | 状態 |
|---|---|
| 独立したComposer状態管理、IME待機、STALE、旧応答破棄、MTL編集、再試行 | 実装・ユニットテスト済み |
| 下書き置換確認、重複防止、200文字制限、投稿操作なし | Adapter実装・模擬DOMテスト済み |
| 字幕表示と設定、単体プレビュー | 実装・構文検査済み。画面目視は未実施 |
| Gemini REST Adapter | 実装・HTTPモックテスト済み。実キーで未検証 |
| Deepgram streaming Adapter | 実装・Socket/Recorderモックテスト済み。実音声で未検証 |
| MV3 worker / offscreen / tabCapture | 実装。拡張を実際に読み込む統合テストは未実施 |
| YouTube現行DOM、Emote、全画面、チャット再読込 | 実機確認待ち |
| API料金、認識品質、混在言語性能、実遅延 | 実測前 |

この作業環境ではブラウザー操作ツールがlocalhostへの接続をブロックし、file URLもブラウザーポリシーで許可されませんでした。そのため画面確認・実機確認を成功扱いにしていません。ユーザーのブラウザーへ拡張をインストールしたり、実APIを呼び出したりもしていません。

## キーとデータ

- キーは `chrome.storage.session` に保存。Chrome終了・拡張再読み込み等で消えます。永続的な暗号化保管ではありません。
- キーはcontent scriptへ返さず、YouTubeのDOMやページ向けメッセージにも含めません。設定ページ・worker・offscreen間の信頼された拡張通信では利用します。
- STTと翻訳のキーは別です。キー削除ボタンは両方を消し、進行中処理を中断します。
- Deepgram選択時はタブ音声をDeepgramへ送ります。広告等を含むタブ内の音声全体が取得対象です。
- Gemini選択時は自分の入力、翻訳文、字幕原文をGoogleへ送ります。Kero側の収集サーバー、解析SDK、翻訳履歴保存はありません。
- Deepgramは `mip_opt_out=true` を付けます。Google等のデータ利用条件はProvider契約・料金枠に依存します。「BYOK＝外部で学習されない」とは説明しません。
- 自動再試行・有料Providerへの自動切替は行いません。キャンセル前に送ったリクエストの課金は取り消せない場合があります。

## 開発・再現

依存ライブラリ・ビルド・npm installは不要。Node.js 22以降を推奨します。

```powershell
node --test tests/composer.test.js tests/providers.test.js tests/youtube.test.js tests/stt.test.js tests/background.test.js tests/offscreen.test.js
node tools/check.js
node tools/standalone.js
powershell -NoProfile -File tools/package.ps1
node tools/serve.js
```

最後のコマンドはローカルプレビューサーバーをポート4173で起動します。普段は単体HTMLで十分です。

```text
extension/
  manifest.json          Chromeへ読み込むエントリー
  background.js          権限・キー・Composer通信・開始停止
  offscreen.js           音声取得と再生・STT→翻訳の接続
  core/composer.js        UIに依存しない版管理
  core/providers.js       Translation Adapter（Demo / Gemini）
  core/stt.js             STT Adapter（Demo / Deepgram）
  youtube.js              YouTube固有DOMへの依存
  content.js              watch / live_chatへの組み込み
  ui/                    共通Composerと字幕
  options.* / popup.*     設定と開始停止
demo/                    同じUIを利用するプレビュー
tests/                   42件のオフラインテスト
docs/DESIGN.md           設計・採用案・比較順・出典
docs/ACCEPTANCE.md       実機確認手順と受入条件
docs/reference/          元の引継ぎ仕様書・設計依頼文
artifacts/               ダウンロード用HTMLプレビューと拡張ZIP
```

次は実際にChromeへ読み込み、A02/A03/A09/A11/A13を優先して確認します。PoC全体の合格判定はまだです。

