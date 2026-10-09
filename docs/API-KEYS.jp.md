# はじめてのAPIキー設定：Deepgram + Gemini

[English](API-KEYS.md) · [READMEへ戻る](../README.jp.md)

プログラミングは不要です。**2つのサービスでキーを作り、KeroTranslateの設定に貼り付ける**だけで準備できます。作者の利用環境では、Deepgramの無料クレジットとGeminiの無料利用枠を使った組み合わせで動作確認済みです。

## APIって何？ キーは何に使うの？

APIは、アプリから外部サービスへ仕事を頼むための窓口です。KeroTranslateは、配信の音声を文字にする処理や翻訳を外部サービスへ依頼します。**APIキーは「あなたのアカウントでそのサービスを使うための専用の鍵」**です。ログインパスワードとは別に発行します。

| サービス | KeroTranslateでの役割 | 用意するもの |
|---|---|---|
| **Deepgram** | 配信音声を文字にする。画面の **STT** はこの音声認識のことです。 | DeepgramのアカウントとAPIキー |
| **Gemini** | 字幕・コメントを翻訳し、re-MTLで元の言語へ訳し直す。 | GoogleアカウントとGemini APIキー |

コメント翻訳だけを使うならGeminiのキーから準備できます。音声字幕も使うときはDeepgramのキーも必要です。この組み合わせでは、タブの音声はDeepgramへ、認識した文章やコメント・訳文はGeminiへ送られます。

## 1. Deepgramのキーを作る

1. [Deepgram Console（登録・ログイン）](https://console.deepgram.com/)を開き、アカウントを作成するかログインします。
2. 左上のプロジェクトを選び、**Settings → API Keys → Create a New API Key**を開きます。プロジェクトはキーや利用量をまとめる入れ物で、初回登録時に作成されます。
3. 名前を `KeroTranslate` などにします。Permissions（権限）でロールを選ぶ場合は **Member**、有効期限は用途に合わせて選び、**Create Key**を押します。[権限の公式説明](https://developers.deepgram.com/guides/deep-dives/working-with-roles)
4. 表示されたキーの文字列をコピーして安全に保管します。**キーの全文は再表示できないため、この時点で控えてください。**

画面の名前が変わっていたら、[Deepgram公式のキー作成手順](https://developers.deepgram.com/docs/create-additional-api-keys)を参照してください。キーの名前やプロジェクトIDではなく、発行されたキー本体を使います。

## 2. Geminiのキーを作る

1. [Google AI StudioのAPIキーページ](https://aistudio.google.com/apikey)を開き、Googleアカウントでログインします。初回は表示された利用条件を確認します。
2. 初回に自動作成されたキーを使うか、**Create API key（APIキーを作成）**を選びます。必要に応じて自分のプロジェクトを選択・作成します。
3. キーをコピーして保管します。既存プロジェクトが見えない場合は **Projects → Import projects** から追加できます。
4. 無料枠で試す場合は、そのプロジェクトの料金区分が **Free Tier** であることを確認します。有料化のための **Set up billing** を進める必要はありません。

[Google公式のキー作成手順](https://ai.google.dev/gemini-api/docs/api-key) · [無料枠・課金の説明](https://ai.google.dev/gemini-api/docs/billing)

## 3. KeroTranslateに貼り付ける

ChromeのKeroTranslateアイコンから **Settings & API keys** を開き、次のように設定します。メインパネルの歯車からも開けます。

| 設定欄 | 選ぶ・貼り付けるもの |
|---|---|
| **Speech to text** | **Deepgram** |
| **Deepgram API key** | 手順1で作ったDeepgramのキー |
| **Translation + re-MTL** | **Gemini** |
| **Gemini API key** | 手順2で作ったGeminiのキー |
| **Gemini model ID** | 最初は初期値で試します。利用できないと表示されたら、自分のAPIプロジェクトで使えるモデルIDを確認します。 |

**Save settings**を押せば保存完了です。同じChromeプロファイル・同じ拡張のままなら、Chromeを終了してもキーは残ります。設定保存は動作中の字幕取得を停止するので、必要なら開始し直してください。

まずOriginalに短いコメントを入力し、MTLとre-MTLが出るか確認します。字幕は音声の流れているYouTube Liveタブで、**ツールバーのKeroTranslateアイコン → Start captions**を押して試します。動作確認にチャット投稿は不要です。

## 無料で使える範囲と、困ったとき

| 項目 | 知っておくこと |
|---|---|
| Deepgramの無料枠 | 無料クレジットを使う方式です。確認時点の公式案内は新規登録時に200米ドル分。使い放題・毎月の補充ではありません。[料金・最新条件](https://deepgram.com/pricing) |
| Geminiの無料枠 | Free Tierで対象モデルを上限内で使う方式です。モデル・プロジェクトで利用可否や制限が異なります。[料金](https://ai.google.dev/gemini-api/docs/pricing)・[現在の制限の確認方法](https://ai.google.dev/gemini-api/docs/rate-limits) |
| キーが無効・認証エラー | サービスごとの欄を取り違えていないか、全文をコピーしたか、有効期限が切れていないかを確認します。 |
| 回数制限・利用枠のエラー | 各サービスの残量・上限を確認。回数制限なら指定時間を待ち、[Request gapの調整](../README.jp.md#翻訳リクエストの調整)も試します。残高不足や利用枠の枯渇は間隔変更だけでは解消しません。 |
| キーをなくした・公開してしまった | 公式の管理画面で該当キーを削除・無効化し、新しいキーを作って拡張に保存します。 |

**キーはパスワードと同じように扱い、チャット・GitHub・公開スクリーンショットに載せないでください。** Geminiの無料枠では入力・出力がサービス改善に使われる場合があります。[Googleの料金・データ利用の説明](https://ai.google.dev/gemini-api/docs/pricing)を確認し、機密情報を入力しないでください。

公式手順・料金条件の確認日：2026-10-10。画面や無料枠は変更されることがあります。動作確認済みの記載は作者の利用環境での結果で、すべてのアカウント・モデルでの動作を保証するものではありません。
