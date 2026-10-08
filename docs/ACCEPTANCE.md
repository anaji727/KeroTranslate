# Acceptance and real-browser testing

[日本語の原文](ACCEPTANCE.jp.md) · [README](../README.md)

Updated October 8, 2026 for Beta 0.1.11. Record actual streaming and API results here; do not invent performance figures. The Japanese counterpart preserves the previous testing record, with the beta changes noted at the top.

## Evidence and its limits

Offline Node tests cover stale responses, slow back-translation, IME input, direction changes, manual MTL edits, stage-specific retries, empty input and disposal; HTTP error classification and missing keys; draft/emote preservation and ambiguous inputs; socket stop/races/backpressure; secret/configuration boundaries; late audio events after Stop; and the shared translation queue. Beta 0.1.10 adds checks for retiring Demo adapters, migration of old provider settings and missing-key rejection before capture. Beta 0.1.11 adds simulated browser/worker restart, persistent-key deletion, legacy migration, local-key precedence and storage-failure checks. All 99 offline tests pass. Syntax and manifest entry files are checked separately.

Before the Demo preview was retired, its bundled JavaScript was syntax-checked. Its local HTTP server was also checked for successful HTML/CSS/JS delivery and MIME types, 404 responses, and rejection of paths outside the public root. A Windows trailing-separator bug was fixed. These were HTTP checks, not evidence of rendered UI or browser interaction.

The user reported working captions. Read-only inspection found YouTube's chat input uses an empty `contenteditable` attribute, and detection was adjusted. Partial display, caption size/retention, INSERT fixes and capture controls have implementation and offline coverage. Updated end-to-end browser checks are still incomplete. Mocks do not validate Chrome, YouTube or provider services themselves. No real chat message was sent during development.

## Recommended validation order

1. Load the unpacked beta using Chrome Developer mode. Check extension errors, the settings page, frog icon and Beta version. Confirm there is no Demo selection or Try sample button. Without keys, Start captions must explain which key is missing and must not start capture.
2. With configured keys, start and stop entirely in the target tab's toolbar popup. Check the main panel placement and access to the native input and emotes.
3. Without posting, INSERT Original/MTL into empty, text-only and emote-only drafts. Confirm replacement prompts.
4. With each translation provider, test a short sentence, direction changes, rapid typing, MTL edits, IME and back-translation.
5. With each STT provider, first capture ten seconds, then one minute. Stream audio must stay audible; Chrome's capture indicator must disappear after Stop.
6. During capture, test navigation, closing the tab, network loss, saving settings, deleting keys and worker restart. Save keys, fully close and reopen Chrome, and confirm the same installation restores keys without starting capture. Reload the extension and verify again. Delete keys, restart Chrome and confirm they remain absent. Actual Chrome restart validation is pending; automated checks simulate storage lifetimes.
7. Evaluate ten minutes of mixed-language audio and reconcile usage with provider dashboards.

## Acceptance matrix

| ID | Requirement | Evidence / remaining work |
|---|---|---|
| A01 | MTL and its corresponding re-MTL | State tests; live translation pending |
| A02 | Insert Original without sending | Mock DOM; current YouTube validation pending |
| A03 | Insert only current MTL without sending | State/mock DOM; real-browser validation pending |
| A04 | Read-only re-MTL, no INSERT | Source checked; visual/accessibility check pending |
| A05 | Old results never overwrite new input | Async tests; check with real traffic too |
| A06 | No translation during IME composition | State tests; Japanese IME check pending |
| A07 | Distinct errors, preserved original, retry | HTTP/state tests; real bad-key/quota checks pending |
| A08 | Independent STT/translation choices | Three STT and four translation adapters; live comparisons pending |
| A09 | Hear stream audio while reading captions | User reported captions; audio routing/long sessions need checks |
| A10 | Three display modes, nine positions | Implemented including size/time/partials; inspect all anchors and line/width settings |
| A11 | No stale results after Stop/navigation | Worker/socket mocks; live navigation/close pending |
| A12 | Never silently erase a draft | Mock DOM; test real emote drafts |
| A13 | Preserve native reading/posting/emotes | Not fully verified; the user can check ordinary manual posting if needed |
| A14 | No unwanted transfer or collection | Source and secret-boundary tests; browser Network/storage audit pending |
| A15 | Mixed-language quality, latency and cost | Not measured |

## Evaluation material

Use audio you have permission to use: English-only, Japanese-only, switches between and within sentences, names, emotes, music, singing, laughter and silence. Have a person evaluate meaning. Natural back-translation alone is not a pass criterion.

## Measurements

The composer displays elapsed time from translation start to completed re-MTL when READY. This excludes the 650 ms input debounce. Record perceived time from the end of typing separately.

The offscreen process collects elapsed audio seconds, bytes sent where available, final segments, translation attempts/errors, returned input/output tokens (including reported thinking tokens), billed characters and the last translation duration. It updates session storage every five seconds. Metrics exclude transcript text and keys. Read them in the extension worker's developer tools:

```javascript
await chrome.storage.session.get('metrics')
```

These are partial aggregates for the latest incoming session. They omit the final interval shorter than five seconds, some aborted-request usage and composer costs. OpenAI WebRTC byte/STT token counts are not measured. DeepL characters are not converted to tokens. This is not a billing meter; reconcile with provider dashboards. Automatic STT-final latency, percentiles and comparison graphs are not implemented.

| Metric | Method |
|---|---|
| Audio → final STT | Timestamp permitted material; measure utterance end to confirmed display |
| STT → MTL | Final segment reception to translation display; also count skipped segments |
| Input → MTL → re-MTL | At least 30 sentences, p50/p95, distinguishing inclusion/exclusion of debounce |
| Effort to INSERT | Click count and time with direction changes, edits and existing drafts |
| Cost | Before/after provider dashboard usage, with model, language and billing conditions |
| Accuracy | Human classification of omitted/reversed meaning, names and tone/politeness errors |

Sent work may remain billable after Stop. Discarded UI results are not equivalent to unbilled requests.

## Constraints

- Favoring the latest caption means no guarantee of a full transcript or every utterance.
- NO_SPEECH means no recognition for 15 seconds, not amplitude-based silence detection. OpenAI's separate local endpointing heuristic does not change that meaning.
- Replays, Shorts, embedded players, pop-outs and fullscreen do not have confirmed formal support.
- Chat insertion depends on `execCommand('insertText')` and YouTube's private DOM. Unknown/ambiguous inputs fail rather than writing into unrelated fields.
- Both the overlay and composer require real YouTube integration testing.
- The conservative 200-unit JavaScript string limit is not guaranteed to match YouTube's emoji counting.

## Checks added in earlier releases

**0.1.7:** Offline checks cover popup controls, tab-scoped status, not stopping another tab, and recovery from transient/detached overlays. Actual Chrome tab-audio permission and first-start behavior need real-browser validation. See [Chrome tabCapture](https://developer.chrome.com/docs/extensions/reference/api/tabCapture).

**0.1.8:** Worker integration tests overlap caption MTL, comment MTL and re-MTL and verify ordering and a maximum of one simultaneous HTTP translation per provider. Other checks cover queued cancellation, rejecting pending work after 429, and numeric/date Retry-After. Live request/token quotas remain unverified.

In the browser, enter a comment and edit MTL while captions use the same provider. Check spacing, retained captions and cancellation on Stop/settings changes. Do not deliberately flood an API to trigger 429. Since 0.1.8, `lastTranslationMs` includes queue waiting; `requests` counts caption translation attempts, including cancellation/rejection before HTTP, not billable requests.
