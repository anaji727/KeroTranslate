# KeroTranslate 0.1.6 — Provider追加

> **0.1.11以降の変更:** APIキーはローカル保存され、Chrome終了・拡張の再読み込み後も保持されます。以下のセッション保存・再入力の説明は旧版の記録です。キー削除ボタンで保存済みキーを削除できます。

[English](PROVIDERS-0.1.6.md) · [最新のREADME](../README.jp.md)

> 旧版の設計・検証記録です。元の日本語資料を保持しています（元が英語の記録は日本語訳）。Beta 0.1.10ではDemoを削除しました。最新の導入手順は上記READMEを参照してください。

2026-10-07。公式仕様を確認して実装し、通信を模擬したテストで検証。実アカウントへの接続、料金、品質、実配信での遅延は未検証です。

## 実装した経路

| 選択 | 接続先 | 動作 |
|---|---|---|
| OpenAI翻訳 | `https://api.openai.com/v1/responses` | `gpt-4.1-mini`初期値、モデル変更可、`store:false`。完了したassistantテキストのみ採用 |
| OpenAI STT | `https://api.openai.com/v1/realtime/calls` + WebRTC | `gpt-live-transcribe`、transcription専用セッション。deltaをpartial、completedをfinalへ変換 |
| DeepL翻訳 | `https://api-free.deepl.com/v2/translate` または `https://api.deepl.com/v2/translate` | Free/Proを明示選択。字幕は言語自動検出、コメントは指定方向 |
| DeepL STT | `https://api.deepl.com/v3/voice/realtime` + `wss://api.deepl.com/v3/voice/realtime/connect` | ソース文字起こしのみ要求。mono WebM/Opus、200ms単位で送信。tentative/concludedを表示へ変換 |
| DeepSeek翻訳 | `https://api.deepseek.com/chat/completions` | `deepseek-flash`初期値、モデル変更可、Thinking無効。正常完了contentのみ採用 |

音声認識・翻訳は別々の選択です。同じ会社を両方に選んでも、音声認識確定後にテキスト翻訳を別リクエストします。別会社を選ぶ場合は認識原文が翻訳先にも送られます。DeepSeekのSTT経路は実装していません。

## 音声の区切りと順序

OpenAIのliveモデルはserver VADを受け付けないため、Web Audioの音量から拡張側で区切りを判定します。約600msの静音、継続音は約8秒でcommit。発話を検出しない10秒間はバッファをclearします。これは声とBGMを分類するVADではなく、音楽や小声で誤判定し得る実験的な値です。partialはcommitを待たずに表示し、翻訳はfinalの後だけ要求します。

OpenAIのitem IDごとに順序を保持し、古いfinalが後着しても新しい字幕の翻訳待ちを巻き戻しません。DeepLは確定部分をまとめて1区間とし、新しいtentativeを次区間として表示します。DeepLの確定単位は文末と一致しないことがあり、文結合は今後の改善対象です。

## キー・通信・停止

個人が自分のAPIキーを設定するBYOK拡張です。共用のアプリキーを埋め込んで配布する設計ではありません。長期キーはtrusted extension context内だけで取り扱い、YouTubeのDOMやcontent scriptへ渡しません。OpenAIのWebRTC初期化はoffscreenから直接認証し、アプリ側の仲介サーバーは用意していません。

DeepL Voiceだけは公式方式に従い短期接続トークンをWebSocket URLに付けます。受信した接続先のoriginとpathを固定の許可先と照合し、URLやトークンをUI・指標へ出しません。長期APIキーはHTTPヘッダーです。

拡張のhost permissionsとCSPには使用する公式ホストだけを追加しました。DeepLの通常Webページ向けCORS制限と、拡張のtrusted contextからの接続は実機で確認が必要です。非公式プロキシへの転送はありません。

Stop・設定変更・キー削除で認識接続と音声処理を終了し、接続初期化のHTTPも中断します。途中で返った応答から新しい接続を作りません。接続失敗は手動再試行とし、別の課金Providerへ自動で切り替えません。すでに送った処理の料金までは取り消せません。

## 検証

76件のオフラインテスト。新規分ではリクエスト先・認証・応答解析・未完了出力の拒否、DeepL Free/Pro、文字数とトークンの分離、キャンセル、STTのpartial/final・順序・Stop競合・送信待ち上限・接続先検証・全キーの秘密境界を確認しています。構文検査・配布物生成も実施しています。

実機では以下を順に確認してください。

1. 拡張とYouTubeを再読み込みし、設定で対応キーを再入力。追加の公式接続先権限が有効なことを確認。
2. 各翻訳Providerで短文を日→英、英→日へ変換し、MTL編集後のre-MTLも確認。DeepLはキーに合うFree/Proを選ぶ。
3. STTは最初Original onlyで10秒程度から試し、partial、final、配信音声の継続再生、Stop後の取得終了を確認。
4. 翻訳を組み合わせ、前の訳文と新しいpartialの共存を確認。OpenAIでは無音・連続音・BGM・小声で区切りを確認。
5. 接続中・翻訳中のStop、設定保存、キー削除、タブ移動、回線切断を確認。Providerの管理画面で利用量を照合。

OpenAIのWebRTC送信バイト数とSTTトークンは現在の指標では計測しません。DeepL翻訳は`billedCharacters`、他社翻訳は返却されたtokensを集計します。これらは途中集計であり請求メーターではありません。

## 参照した公式資料

- [OpenAI text generation](https://developers.openai.com/api/docs/guides/text)
- [OpenAI Realtime transcription](https://developers.openai.com/api/docs/guides/realtime-transcription)
- [OpenAI WebRTC connection](https://developers.openai.com/api/docs/guides/voice-webrtc?voice-api=realtime)
- [DeepL text translation](https://developers.deepl.com/api-reference/translate/request-translation)
- [DeepL Voice quickstart](https://developers.deepl.com/docs/voice/real-time-voice-quickstart)
- [DeepL Voice session / supported formats](https://developers.deepl.com/api-reference/voice/request-session)
- [DeepSeek Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/)
