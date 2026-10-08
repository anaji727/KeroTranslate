# Caption timing and size — 0.1.2

> **Since 0.1.11:** API keys persist locally across Chrome restarts and extension reloads. Session-only storage and re-entry instructions below describe the historical version. Delete all API keys removes saved credentials.

[日本語](CAPTION-SETTINGS-0.1.2.jp.md) · [Current installation instructions](../README.md)

Historical release note. The standalone preview mentioned below was removed in Beta 0.1.10.

The user confirmed that captions appeared in their environment. This update addresses captions disappearing before their translation arrives.

- Source text awaiting translation does not expire. If an earlier translation exists, keep it and its corresponding original visible.
- Start the reading timer when translation arrives. While the next translation is pending, retain the current caption; replace it when the next translation arrives. Stop clears captions immediately.
- A new utterance does not cancel an active translation. If the API is slow, keep only the newest waiting segment to prevent an ever-growing delay. Intermediate segments are skipped in this case.
- **Settings → 03 / Captions → Caption size:** 75 / 100 / 125 / 150 / 200%, default 100%. Scale the original and translation together.
- **Keep captions after translation:** 5 / 7 / 10 / 15 / 20 seconds, default 10. Original-only mode measures from the original-text update.
- The standalone preview at the time also allowed size changes.

Reload the updated extension and then YouTube. Extension reload clears session API keys, so enter them again. Save settings and restart captions.

Offline tests cover pending translation, continuous speech, late responses after Stop, reading time and size settings. Readability and live display after this update still require checks in the user's environment.
