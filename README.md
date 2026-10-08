# 🐸 KeroTranslate

[日本語](README.jp.md)

Live captions and comment translation for YouTube Live, built as a Chrome extension for English and Japanese viewers.

Follow a stream with original and translated captions. Draft a comment, translate it, and use back-translation to check its meaning before inserting it into YouTube's chat input.

**INSERT only fills the chat input. It never sends a message. You review and post it yourself.**

Current version: **Beta 0.1.12** (October 8, 2026).

## Install the beta

**KeroTranslate is still in beta. For this release, enable Chrome's Developer mode and load the unpacked extension using the steps below.**

1. Download the [Download Chrome extension ZIP](https://github.com/anaji727/KeroTranslate/raw/refs/heads/main/artifacts/KeroTranslate-Extension.zip) and extract it to a folder you will keep. Alternatively, use the repository's `extension/` folder.
2. Open `chrome://extensions` in Chrome 116 or later.
3. Enable **Developer mode** in the upper-right corner.
4. Click **Load unpacked** and select the folder that directly contains `manifest.json`.
5. Open or reload a YouTube Live watch page with live chat available.
6. Open KeroTranslate's toolbar popup, then **Settings & API keys**. The main panel's gear button opens the same settings.
7. Choose your speech recognition and translation providers, enter your own API keys, and save. Check that the configured model IDs are available to your account.
8. On that YouTube tab, open the toolbar popup and press **Start captions**. You can close the popup once capture starts. **Stop** is available in both the popup and the main panel.

There is no Demo mode or bundled sample preview in this release. The initial selections are **Deepgram** for speech recognition and **Gemini** for translation. API keys are required; no provider account or API credit is included. Installing the extension does not start capture automatically.

Chrome requires you to invoke the extension on the target tab before tab audio capture can start. Start from the toolbar popup on a new tab. The extension captures that tab's audio, not your microphone.

### Update an existing installation

1. Stop captions, then replace the files in the folder Chrome currently loads.
2. Click **Reload** for KeroTranslate in `chrome://extensions`.
3. Reload the YouTube page as well.
4. Restart captions from the toolbar popup. Saved API keys are retained in the same Chrome profile and extension installation.

**Saved API keys survive Chrome restarts and extension reloads.** They are stored locally in this Chrome profile, not synced to other devices. Use **Delete all API keys** in Settings to remove them. Removing the extension or clearing its data removes saved keys. Saving settings still stops the current audio session. Keep the same unpacked installation folder when updating; loading another folder may create a separate extension installation.

When upgrading from 0.1.10 or earlier, any remaining session keys are migrated. If the old version's session keys were already cleared during the update, enter and save them once in the new version.

Saved language preferences are preserved. Old `demo` provider selections are normalized to Deepgram/Gemini; configure the corresponding keys or select different providers before use.

## Providers and API keys

Speech recognition and translation are independent. For example, you can combine OpenAI speech recognition with DeepL translation. Comment translation and back-translation use the same selected translation provider and model.

| Provider | Speech recognition | Translation / back-translation | Configuration |
|---|---|---|---|
| Deepgram | Nova-3 | — | Deepgram API key |
| Gemini | — | Supported | Gemini API key and model ID |
| OpenAI | `gpt-live-transcribe` | Supported | OpenAI API key; default translation model `gpt-4.1-mini` |
| DeepL | Voice API, requiring an eligible paid account | API Free / API Pro | DeepL API key and matching translation plan |
| DeepSeek | — | Supported | DeepSeek API key; default model `deepseek-flash` |

The default Gemini model ID is `gemini-3.5-flash-lite`. These are implementation defaults, not guarantees of model availability. Verify access, region, quota and billing in your provider account. A ChatGPT or DeepL website subscription is separate from API access.

The adapters added in 0.1.6 remain experimental: their request/response handling has offline test coverage, but live accounts, translation quality and end-to-end latency have not all been validated. See the [provider integration notes](docs/PROVIDERS-0.1.6.md).

- OpenAI speech recognition shows partial text before finalization. Its experimental local endpointing commits after about 600 ms of quiet, or at approximately eight seconds of continuous sound. This is an amplitude heuristic; music and quiet speech can affect it. The thresholds are not user-configurable yet.
- DeepL's API Free/Pro selection controls text translation, not Voice eligibility. Voice requests source transcription only; translation is a separate request.
- DeepSeek is available for text translation only. The adapter disables Thinking and accepts only completed response content.
- Settings show fields for the selected providers. Switching providers preserves other saved keys. **Delete all API keys** clears them together.

## Live captions

- **Partial:** show provisional source text in a dim color with an ellipsis. Revisions update the same segment.
- **Final:** show confirmed source text normally, then request translation. Partial updates do not trigger translation API calls.
- Keep the previous translation and its original visible while displaying a new recognition segment separately. A delayed translation does not erase newer partial text.
- Start the reading timer after translation arrives. Keep the caption while the next translation is pending; replace it when the new translation arrives.
- When translation falls behind, finish the active segment and keep only the newest waiting segment. Intermediate segments can be skipped; this is not a complete transcript recorder.

Under **Settings → 03 / Captions**:

| Setting | Choices / default |
|---|---|
| Show | Original + MTL (default), Original only, MTL only |
| Caption size | 75 / 100 / 125 / 150 / 200%; default 100% |
| Keep captions after translation | 5 / 7 / 10 / 15 / 20 seconds; default 5 |
| Maximum lines per language | 1 or 2; default 2, including provisional text |
| Position | Nine anchors in a 3×3 grid; default bottom-center |

The five-second reading time starts when the translation arrives. If captions disappear before you finish reading, try 7–10 seconds, or 15–20 seconds for longer passages. New translations can replace the current caption sooner, and waiting for the next translation can keep it visible longer. This setting controls display time, not translation speed or request frequency. Saved display preferences are preserved; existing users can select five seconds manually.

Partial text is visible in Original + MTL and Original only. MTL only hides the original. Original only does not call the caption translation API; its timer starts from the original-text update.

Under **Settings → 02 / Languages**, **Speech language** describes the stream audio and **Translate captions into** selects caption output. These are independent of the comment composer's direction. For a Japanese stream, you can explicitly choose Japanese. Mixed-language recognition is experimental.

## Draft and translate comments

The initial **Composer original language** setting is **English → Japanese**. Existing saved preferences are preserved. Change and save the default under **Settings → 02 / Languages**. The main panel uses the green-and-white frog icon and displays the beta version.

1. Type into **Original** and choose EN → JA or JA → EN.
2. Review **MTL** and **re-MTL**, the back-translation used as a meaning check. Back-translation does not guarantee accuracy.
3. Edit the current MTL if necessary; this regenerates re-MTL.
4. Click **INSERT** beside Original or MTL. MTL insertion is enabled only when the latest back-translation finishes.
5. Review the draft in YouTube and send it yourself.

If YouTube already has a draft, choose **Replace draft** or **Keep draft**. Repeated insertion does not duplicate identical text. The insertion limit is 200 JavaScript string units, a conservative limit that may differ from YouTube's counting of emoji. Translation waits during Japanese IME composition, and stale responses cannot replace newer input.

## Shared request scheduling

Caption translation, comment translation and back-translation share a background queue per translation provider. Only one translation HTTP request runs at a time per provider. Waiting comments have priority; an active caption request finishes first. Speech recognition streams are separate from this queue.

**Minimum interval between translation requests** defaults to one second, at most approximately 60 starts per minute. Choices are 0.5 / 1 / 2 / 4 / 6 / 12 seconds. A comment normally requires two requests, sharing the same allowance as captions. Start with one second for shorter queue waits. If rate-limit errors occur, increase the interval to 2–4 seconds, or 6–12 seconds for stricter limits, according to your provider account. A shorter interval can increase request volume and cost; it does not speed up the provider itself or guarantee quota availability. Saved settings are preserved on update; existing users can select one second manually in Settings.

After HTTP 429 or 456, that provider pauses according to Retry-After, capped at 24 hours, or for 30 seconds if no usable value is returned. Failed and queued work is not automatically replayed. Retry a comment after the indicated delay; captions resume with new recognition segments. Stop, input changes and key deletion cancel unneeded pending work.

This addresses concurrency and bursts, not daily quotas, token limits or other apps sharing the same API project. Reloading the extension or restarting its worker resets the queue and cooldown. See [Gemini's rate-limit documentation](https://ai.google.dev/gemini-api/docs/rate-limits).

## Troubleshooting

| Symptom | Check |
|---|---|
| No main panel | Open live chat on a normal YouTube Live watch page and reload YouTube |
| Overlay initialization error | Wait for the video to load; reload YouTube after updating the extension, then start from the toolbar |
| No captions | Use **Test overlay** in the popup to check display with a fixed caption, without audio or provider requests |
| LISTENING but no transcript | Check stream audio, Speech language and provider usage; connected status alone does not prove recognition |
| Prompt to open the toolbar icon | Invoke the extension on the current tab and start from its popup |
| NO_SPEECH | No recognition results have arrived for 15 seconds; this does not measure actual silence |
| INSERT unavailable | Check sign-in, chat permissions and input availability; YouTube DOM changes can affect detection |
| Missing key after an update | Check that you updated the same installation in the same Chrome profile. Upgrading from session-only versions may require one final entry; save it in Settings |
| Old Demo settings | Select real providers and configure their keys; Demo was removed in Beta 0.1.10 |

**Test overlay is a display diagnostic, not a Demo provider or a translation mode.**

## Keys and data

- Keys are held in `chrome.storage.local`, restricted to trusted extension contexts. They are not returned to content scripts or placed in YouTube's DOM, and are not sent to Chrome Sync. Local extension storage is not an encrypted credential vault. Capture state and usage metrics remain session-only.
- Tab audio goes to your selected Deepgram, OpenAI or DeepL speech provider. Comment text, translations and caption transcripts go to the selected translation provider.
- KeroTranslate has no separate collection server, analytics SDK or translation-history storage.
- Deepgram requests include `mip_opt_out=true`. Data policies, free allowances and charges depend on each provider and your agreement.
- There is no automatic switch to another paid provider. Work already sent can remain billable after Stop.

## Validation and limitations

The user has reported working captions. Offline tests cover state transitions, cancellation, provider requests, chat insertion, permission boundaries and request scheduling. Those tests do not prove live API operation or browser rendering. No live chat message has been posted by the development workflow.

The current UI still needs end-to-end checks in Chrome, including INSERT, fullscreen, theater mode and pop-out chat. Mixed-language quality, latency and cost need measurement with actual accounts. See [acceptance and testing](docs/ACCEPTANCE.md).

Configurable VAD thresholds, merging following utterances, entity normalization, per-stage latency visualization, full transcripts and OBS integration are not implemented.

## Development

There are no runtime dependencies to install and no bundler requirement. Node.js 22 or later is recommended for development commands.

```powershell
node tools/sync-version.js
node --test tests/*.test.js
node tools/check.js
./tools/package.ps1
```

`sync-version.js` reads the extension manifest and updates the beta labels. The package script runs it automatically before building the ZIP. Update `package.json` and `extension/manifest.json` together. Test doubles live in `tests/`; they are not shipped as providers. The old standalone Demo preview and its build/serve tools have been removed.

| Location | Contents |
|---|---|
| `extension/` | Unpacked Chrome extension |
| `tests/` | Offline state, provider, audio, queue and YouTube adapter tests |
| `tools/` | Version-label synchronization, checks and ZIP packaging |
| `artifacts/` | Extension ZIP; local artwork may also exist in a development workspace |
| [Design](docs/DESIGN.md) | Architecture and historical design decisions |
| [Acceptance](docs/ACCEPTANCE.md) | Real-browser checks and remaining validation |
| `docs/reference/` | Original design handoff, retained as historical reference |

English is the primary documentation language. Each document links to a corresponding `.jp.md` Japanese version. Historical notes describe their original releases; use this README for current installation instructions.

## Changelog

- **Beta 0.1.12:** Default translation request spacing to one second and caption retention after translation to five seconds. Preserve saved preferences and add tuning advice.

- **Beta 0.1.11:** Persist API keys locally across Chrome restarts and extension reloads. Migrate remaining legacy session keys, retain trusted-context access restrictions, and remove saved credentials with Delete all API keys.

- **Beta 0.1.10:** Remove Demo providers, sample controls and standalone preview distribution. Default to Deepgram/Gemini with API-key requirements. Publish English-first documentation with Japanese counterparts and beta Developer mode installation instructions.
- **Beta 0.1.9:** Default comment translation to English → Japanese; replace the panel icon with the green-and-white frog; replace LOCAL PoC labels with the beta version synchronized during packaging.
- **0.1.8:** Share a translation queue across captions, comments and back-translation, with comment priority, request spacing and cooldowns.
- **0.1.7:** Restore popup Start/Stop, tab-scoped state and overlay retry/reconnection.
- **0.1.6:** Add OpenAI STT/translation, DeepL Voice/text translation and DeepSeek translation.
- **0.1.5:** Standardize the KeroTranslate name and documentation.
- **0.1.4:** Show dim partial captions and preserve newer recognition alongside delayed translation.
- **0.1.3:** Fix current YouTube input detection and add main-panel capture controls.
- **0.1.2:** Preserve pending captions and add size/reading-time settings.
- **0.1.1:** Retry overlay initialization and add Test overlay.
- **0.1.0:** Initial captions, comment translation and back-translation proof of concept.
