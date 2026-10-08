# Caption initialization fix — 0.1.1

> **Since 0.1.11:** API keys persist locally across Chrome restarts and extension reloads. Session-only storage and re-entry instructions below describe the historical version. Delete all API keys removes saved credentials.

[日本語](CAPTION-FIX-0.1.1.jp.md) · [Current README](../README.md)

> Historical release note. The startup flow changed in 0.1.7: start directly from the toolbar popup on a new tab. Follow the current README for installation.

The reported live page showed LISTENING but no captions. DOM inspection found an empty caption host without the positioning styles that successful initialization sets. This is consistent with partial initialization, but does not prove that speech recognition is delivering transcripts.

The old content script inserted the host before initializing the view and did not check the CONFIG response. An initialization error left a connected host that prevented subsequent attempts. The new code validates settings, initializes detached views before attaching them, retries failed initialization, and ignores configuration responses after navigation. Capture now requires a ready overlay.

The popup includes **Test overlay**, which displays a fixed bilingual caption for seven seconds without capturing audio or calling a provider. It also shows the speech and caption languages separately from the comment composer's direction.

## Update and check

1. Stop captions. Replace the installed extension files with version 0.1.1, then reload the extension in Chrome's extension manager.
2. Reload the YouTube live watch page. Click **Test overlay** in the extension popup.
3. Confirm the test caption appears. For a Japanese stream, select Japanese as the speech language; choose the desired caption translation language separately.
4. Extension reload clears session API keys. Re-enter them in Settings, save, then click **Start captions**.
5. If the test caption appears but live captions do not, the remaining issue is in audio capture, recognition, or translation; LISTENING alone does not prove transcript delivery.

Offline regression tests cover rejected settings, failed view initialization and recovery, and navigation from the YouTube home page. Actual display and live provider operation after updating remain to be verified in the user's browser.
