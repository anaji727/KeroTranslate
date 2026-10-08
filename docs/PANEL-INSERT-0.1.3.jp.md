# INSERTとパネルの操作 — 0.1.3

[English](PANEL-INSERT-0.1.3.md) · [最新のREADME](../README.jp.md)

> 旧版の設計・検証記録です。元の日本語資料を保持しています（元が英語の記録は日本語訳）。Beta 0.1.10ではDemoを削除しました。最新の導入手順は上記READMEを参照してください。

ユーザーのYouTubeライブチャットDOMでは、yt-live-chat-message-input-renderer内の表示中のDIV#inputに `contenteditable=""` が設定されていました。以前のセレクターは `contenteditable="true"` のみを要求していたため、入力欄がないと誤判定していました。修正後は空文字・true・plaintext-onlyを許容します。非表示・無効・編集不可・候補が曖昧な入力欄は引き続き拒否し、既存の下書きの置き換えには確認を求めます。INSERTは送信しません。

この版ではメインパネル上部にStart captionsとStopを置き、音声取得状態とエラーを表示しました。ポップアップには設定とTest overlayを残し、音声取得操作はメインパネルへ案内していました。要求元のタブIDを使うため、パネルから他のタブを指定したり停止したりできません。キーをパネルへ公開しません。

ChromeのtabCaptureは、対象タブで拡張を呼び出した後に利用できます。この版では、新しいタブや拡張の再読み込み後にツールバーアイコンを一度開き、パネルのStart captionsを押す案内を出していました。[ChromeのtabCapture資料](https://developer.chrome.com/docs/extensions/reference/api/tabCapture)を参照してください。

検証では実際の入力欄属性を読み取り確認し、その属性への挿入、下書き保護、操作の振り分け、パネル状態をオフラインテストで確認しました。0.1.3を読み込んだ後の実際の挿入・音声取得は未確認で、開発中にチャット投稿はしていません。
