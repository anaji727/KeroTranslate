# 🐸 KeroTranslate

[English](README.md)

YouTube Liveの音声字幕と、自分のコメント翻訳を支援するChrome拡張です。
配信を見ながら原文・翻訳を読み、自分のコメントは **Original → MTL → re-MTL** で意味を確認できます。

**INSERTはYouTubeの入力欄に下書きを入れるだけ。投稿は自分で行います。**

現在のバージョン: **Beta 0.1.10**（2026-10-08）。
リポジトリ・プロダクトの正式表記は **KeroTranslate** です。

## ダウンロード

- [Chrome拡張ZIP](artifacts/KeroTranslate-Extension.zip)
- [リポジトリ](https://github.com/anaji727/KeroTranslate)

このリリースではDemoモード・固定例文ボタン・単体プレビューを削除しました。音声認識と翻訳には、ご自身のAPIキーが必要です。

## Chromeに読み込む

**まだBeta版のため、Chromeのデベロッパーモードを有効にして読み込んでください。**

1. ZIPを展開します。ソースから使う場合は `extension` フォルダーを使います。
2. Chrome 116以降で `chrome://extensions` を開き、デベロッパーモードを有効にします。
3. 「パッケージ化されていない拡張機能を読み込む」で、`manifest.json` が直下にあるフォルダーを選びます。
4. 開いているYouTubeページを再読み込みします。
5. 拡張アイコンの **Settings & API keys** またはメインパネルの歯車から設定を開きます。
6. 音声認識・翻訳のProviderを選び、対応するAPIキーを入力して保存します。初期設定は音声認識がDeepgram、翻訳がGeminiです。モデルIDはアカウントで使えるものを設定してください。
7. YouTube Liveの視聴タブで **ツールバーのKeroTranslateアイコン → Start captions** を押します。ポップアップ内で開始・停止まで完結します。チャット下のメインパネルにも開始・停止ボタンがあります。

Chromeのタブ音声取得には、そのタブで拡張を呼び出す操作が必要です。新しいタブではツールバーのポップアップ内のStart captionsを使ってください。メインパネルへ戻る必要はありません。開始後はポップアップを閉じても字幕が続き、どちらのStopでも停止できます。音声は対象タブから取得し、マイクは使いません。

### 更新するとき

1. Stopで字幕を停止し、読み込み済みフォルダーのファイルを更新します。
2. Chromeの拡張機能管理画面でKeroTranslateを再読み込みします。
3. YouTubeページも再読み込みします。
4. 設定でAPIキーを再入力・保存し、対象YouTubeタブのツールバーポップアップから再開します。

**APIキーはセッション保存のため、拡張の再読み込みやChrome終了で消えます。** 設定保存も実行中の音声取得を停止します。読み込み元フォルダーの場所を変更した場合は、新しいフォルダーをChromeで読み込み直してください。

## Providerの選択

音声認識と翻訳は独立して選べます。たとえば **OpenAI STT → DeepL翻訳**、**Deepgram STT → DeepSeek翻訳** が可能です。コメントのMTLとre-MTLは同じ翻訳Providerを使います。

| Provider | 音声認識（STT） | 翻訳・再翻訳 | 設定 |
|---|---|---|---|
| Deepgram | Nova-3 | — | Deepgram APIキー |
| Gemini | — | 対応 | Gemini APIキー・モデルID |
| OpenAI | gpt-live-transcribe | 対応 | OpenAI APIキー。翻訳初期モデルはgpt-4.1-mini |
| DeepL | Voice API（有料・利用権限が必要） | API Free / API Pro | DeepL APIキー・翻訳用プラン |
| DeepSeek | — | 対応 | DeepSeek APIキー。初期モデルはdeepseek-flash |

**0.1.6で追加した接続は実験的です。実APIでの通し確認はまだ行っていません。** モデルの利用権限・地域・残高は各APIアカウントで確認してください。ChatGPTやDeepLウェブ版の購読とAPI契約は別です。

- OpenAI STTは途中テキストを先行表示し、約600msの静かな区間で確定します。音が続く場合は約8秒を上限に区切ります。これは音量を用いた簡易判定で、BGMやゲーム音が多い配信は区切りや品質の実測が必要です。現在、このしきい値の設定UIはありません。
- DeepLは翻訳用の **API Free / API Pro** をキーに合わせて選びます。Voiceはこの選択に関係なく有料エンドポイントを使い、Voice API利用権限が必要です。音声認識のみを依頼し、翻訳は選択したProviderへ別途送ります。
- DeepSeekは翻訳用です。公開APIで確認できた範囲にSTT用エンドポイントがないため、音声認識の選択肢には含めていません。翻訳はThinkingを無効にして要求します。
- 選択中のProviderに必要なキーと設定を表示します。切り替えても別Providerのセッション内キーは保持され、**Delete all API keys** でまとめて削除できます。

接続方式・公式資料・実機確認項目は [Provider追加ノート](docs/PROVIDERS-0.1.6.jp.md) にまとめています。

## 配信字幕

- **partial（認識中）**: 受信した原文を薄色＋「…」で先に表示。同じ区間の修正はその場で更新します。
- **final（確定）**: 原文を通常色に切り替え、その後に翻訳を開始します。partialごとに翻訳APIは呼びません。
- 前の翻訳と対応する原文を残し、新しい認識テキストは区切り線の下に表示します。遅れて届いた翻訳が新しいpartialを消さないようにしています。
- 翻訳待ちの間は表示を維持し、翻訳到着後から表示時間を数えます。新しい翻訳が来たら置き換えます。
- 翻訳が追いつかない場合、進行中の1件を完了させ、待機中は最新1区間だけを残します。途中の区間は省略されるため、全文記録用途ではありません。

**Settings → 03 / Captions** で調整できます。

| 設定 | 選択肢 / 初期値 |
|---|---|
| Show | Original + MTL / Original only / MTL only。初期値は両方 |
| Caption size | 75 / 100 / 125 / 150 / 200%。初期値100% |
| Keep captions after translation | 5 / 7 / 10 / 15 / 20秒。初期値10秒 |
| Maximum lines per language | 1 / 2行。初期値2行。認識中の行にも適用 |
| Position | 上・中央・下 × 左・中央・右の9か所。初期値は下中央 |

partialを見るには **Original + MTL** または **Original only** を選びます。MTL onlyでは原文を表示しません。Original onlyでは字幕用の翻訳APIを呼ばず、finalの表示後から表示時間を数えます。

**Settings → 02 / Languages** のSpeech languageが配信の音声言語、Translate captions intoが字幕の翻訳先です。コメント欄のJA → EN / EN → JAとは独立しています。日本語配信ならSpeech languageをJapaneseに設定できます。Mixed languagesは実験的です。

## 翻訳リクエストの調整

字幕・コメントのMTL・re-MTLは、バックグラウンドの共通キューから送信します。同じProviderへのHTTP翻訳は同時に1件だけ。待機中はコメントを優先し、進行中の字幕翻訳は完了を待ちます。音声認識ストリームはこのキューの対象外です。

**Settings → Minimum interval between translation requests** で送信開始の最小間隔を設定できます。初期値は4秒（目安15回/分）、選択肢は0.5 / 1 / 2 / 4 / 6 / 12秒です。コメント1件は通常MTLとre-MTLの2回を使い、字幕と同じ枠に数えます。待ち時間も増えるため、APIアカウントの制限に合わせて調整してください。

429などの制限エラー後は、そのProviderへの送信を一時停止します。Retry-Afterが返ればその時間（最大24時間）、なければ30秒です。失敗した文・待機中の文は自動再送しません。コメントは表示された待機時間の後にRetry、字幕は次に届く新しい区間で再開します。Stop・入力変更・キー削除は不要になった待機リクエストを取り消します。

この制御は同時送信と送信集中への対策です。トークン数・日次枠・同じAPIプロジェクトを使う別アプリの通信までは管理しません。拡張の再読み込み・worker再起動でキューと一時停止状態はリセットされます。[Gemini公式の制限説明](https://ai.google.dev/gemini-api/docs/rate-limits)も参照してください。

## コメント作成

Composer original languageの初期値は **English → Japanese**（英語入力→日本語訳）です。保存済みの設定は保持します。メインパネルには作成済みの緑・白のカエルアイコンを表示します。

1. Originalにコメントを入力し、JA → EN / EN → JAを選びます。
2. MTL（翻訳）とre-MTL（意味確認用の再翻訳）を確認します。再翻訳は正確さの保証ではありません。
3. 必要ならMTLを直接編集します。編集した文からre-MTLを更新します。
4. OriginalまたはMTLの **INSERT** でYouTubeの入力欄へ挿入します。MTLは最新の再翻訳が完了してから挿入できます。
5. YouTube側で確認し、自分で送信します。

既存の下書きがある場合は **Replace draft / Keep draft** を選びます。挿入は200文字以内（JavaScriptの文字列長基準）です。日本語IME入力中は翻訳を待ち、古い応答が新しい入力を上書きしないようにしています。

## 困ったとき

| 症状 | 確認すること |
|---|---|
| パネルが出ない | 通常のYouTube Live視聴画面でライブチャットを開き、YouTubeを再読み込み |
| オーバーレイ初期化エラー | 読み込み中の短い失敗は自動再試行。拡張更新直後はYouTubeを一度再読み込み。配信動画の読み込み後にツールバーから開始 |
| 字幕が出ない | 拡張ポップアップの **Test overlay** で固定字幕が出るか確認。音声・APIを使わず表示だけを試せます |
| LISTENINGなのに字幕がない | 接続中という表示だけでは認識成功は分かりません。配信音声、Speech language、Provider側の利用状況を確認 |
| 開始時に拡張アイコンを開く案内 | そのYouTubeタブで拡張アイコンを開き、ポップアップ内のStart captionsを押す |
| NO_SPEECH | 15秒以上認識結果が届いていない状態。実際の無音を測定した表示ではありません |
| INSERTできない | ログイン・チャットの投稿条件と入力欄を確認。最新版でYouTubeを再読み込み。入力欄はYouTubeのDOM変更の影響を受けます |
| 更新後にAPIキー不足 | 設定でキーを再入力。キーをチャットやIssueに貼る必要はありません |
| 以前のDemo設定が残っている | Deepgram／Geminiに補正されます。対応するキーを設定するか、別のProviderを選んでください |

## キーとデータ

- APIキーは `chrome.storage.session` に保存し、content scriptやYouTubeのDOMへ返しません。永続的な暗号化保管ではありません。
- 音声認識で選んだDeepgram / OpenAI / DeepLへタブ音声を送り、翻訳で選んだGemini / OpenAI / DeepL / DeepSeekへコメント・翻訳文・字幕原文を送ります。
- KeroTranslate独自の収集サーバー、解析SDK、翻訳履歴保存はありません。
- Deepgramには `mip_opt_out=true` を付けています。各Providerのデータ利用条件・無料枠・料金は契約によって異なります。
- 自動の有料Provider切替は行いません。停止前に送信済みの処理はProvider側で課金される場合があります。

## 検証状況と制約

ユーザー環境で字幕が表示されることを確認済みです。開発側では94件のオフラインテスト、JavaScript構文、manifest参照先を検証しています。現在のYouTubeチャット入力欄のDOMも読み取り確認済みです。

partial表示・サイズ調整・INSERT修正・パネル内の開始停止を含む最新版の実機通し確認、全画面・シアター・ポップアウト、混在言語の品質・遅延・費用は引き続き確認が必要です。モックテストの成功を、実APIやすべてのブラウザー表示の成功とは扱っていません。

VAD終端のユーザー設定、後続文マージ、固有名詞補正、区間別レイテンシー表示、全文トランスクリプト、OBS連携は未実装です。

## 開発

依存ライブラリのインストールやビルドは不要です。Node.js 22以降を推奨します。

```powershell
node --test tests/*.test.js
node tools/check.js
./tools/package.ps1
```

`package.ps1` はmanifestからBetaの表示番号を同期し、拡張ZIPを作成します。テスト用の疑似通信は `tests/` 内にあり、拡張には含まれません。

| 場所 | 内容 |
|---|---|
| `extension/` | Chromeへ読み込む拡張本体 |
| `tests/` | 状態管理、字幕、Provider、YouTube入力、権限境界のテスト |
| `tools/` | バージョン表示同期・構文検査・ZIP作成 |
| `artifacts/` | 拡張の配布用ZIP |
| [設計](docs/DESIGN.jp.md) | 設計判断とProvider比較の記録 |
| [受入確認](docs/ACCEPTANCE.jp.md) | 実機確認手順・残作業 |
| `docs/reference/` | 名称を統一した引継ぎ資料の同梱版 |

英語をメインドキュメントとし、日本語版は `.jp.md` に移しました。旧バージョンの記録にあるDemoや操作案内より、このREADMEの導入手順を優先してください。**Test overlay** は音声・APIを使わない表示診断として残しています。

## 更新履歴

- **Beta 0.1.10**: Demo Provider・固定例文ボタン・単体プレビューを削除。初期ProviderをDeepgram／Geminiに変更し、キーを必須化。英語をメインに、日本語を `.jp.md` に分離。Beta版のデベロッパーモード導入手順を明記。

- **Beta 0.1.9**: コメント翻訳の初期方向をEnglish → Japaneseへ変更。メインパネルを緑・白のカエルアイコンへ差し替え。メインパネル・ポップアップ・設定画面のLOCAL PoC表記をBeta＋バージョン番号へ統一。パッケージ作成時にmanifestからバージョン表示を更新。
- **0.1.8**: 字幕・コメント・再翻訳の送信キューを統合。同じProviderは同時1件、コメント優先、最小送信間隔と制限エラー後の一時停止を追加。
- **0.1.7**: ツールバーポップアップにStart captions / Stopを追加。往復不要の開始導線、タブ別状態・停止、オーバーレイ初期化の再試行・再接続を修正。
- **0.1.6**: OpenAIのSTT・翻訳、DeepL VoiceのSTT・Free/Pro翻訳、DeepSeek翻訳を追加。設定・キー管理・字幕順序の処理・テストを更新。
- **0.1.5**: KeroTranslateへ名称統一。README・操作案内を更新。
- **0.1.4**: partialを薄色で先行表示、finalを通常色表示。遅れた翻訳と新しい認識結果を併存。
- **0.1.3**: 現行YouTube入力欄に合わせINSERTを修正。開始・停止をメインパネルへ移設。
- **0.1.2**: 翻訳待ちの表示維持、字幕サイズ・表示時間設定を追加。
- **0.1.1**: 字幕初期化の再試行とTest overlayを追加。
- **0.1.0**: 音声字幕・コメント翻訳・再翻訳のPoCを作成。
