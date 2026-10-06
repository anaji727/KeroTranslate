# INSERT and panel controls — 0.1.3

The user's current YouTube live chat DOM has a visible DIV#input with contenteditable="" inside yt-live-chat-message-input-renderer. The previous selector required contenteditable="true", so it incorrectly reported that the input was unavailable. The adapter now accepts empty, true and plaintext-only values. Hidden, disabled, noneditable and ambiguous inputs remain rejected; existing drafts still require replacement confirmation. INSERT never sends.

Start captions and Stop now appear at the top of the main KeroTranslate chat panel, with capture status and errors. The popup retains settings and Test overlay and points to the main panel for capture controls. Requests use the sender's tab ID; a panel cannot choose another tab or stop its capture. Keys are not exposed to the panel.

Chrome requires the extension to be invoked on a tab before tabCapture can capture it. On a new tab or after extension reload, open the toolbar icon once, then use Start captions in the panel. A capture failure shows this guidance. See https://developer.chrome.com/docs/extensions/reference/api/tabCapture .

Validation: read-only inspection confirmed the live input's actual attribute. Offline tests cover insertion with that attribute, draft protection, control routing and panel state. Live insertion and capture with the updated extension remain to be checked after loading version 0.1.3; no comment was submitted during development.
