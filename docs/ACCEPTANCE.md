# Acceptance and real-browser testing

[日本語の原文](ACCEPTANCE.jp.md) · [README](../README.md)

Updated October 9, 2026 for Beta 0.1.17. Record actual streaming and API results here; do not invent performance figures. The Japanese counterpart preserves the previous testing record, with the beta changes noted at the top.

## Evidence and its limits

Beta 0.1.17 makes MTL progress delivery nonblocking. Regression checks cover an unresolved frame notification, a synchronous delivery failure and late progress after completion. Virtual-clock comparisons show savings only when notification delivery delays the next request; they do not measure real API or YouTube latency. Request spacing and API call counts are unchanged. See the [comment latency experiment](LATENCY-0.1.17.md).

Offline Node tests cover stale responses, slow back-translation, IME input, direction changes, manual MTL edits, full comment retries, empty input and disposal; HTTP error classification and missing keys; draft/emote preservation and ambiguous inputs; socket stop/races/backpressure; secret/configuration boundaries; late audio events after Stop; and the shared translation queue. Beta 0.1.10 adds checks for retiring Demo adapters, migration of old provider settings and missing-key rejection before capture. Beta 0.1.11 adds simulated browser/worker restart, persistent-key deletion, legacy migration, local-key precedence and storage-failure checks. All 132 offline tests pass. Syntax and manifest entry files are checked separately.

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

## Main-panel timing controls (0.1.13)

Offline checks cover timing-only permission and value validation, concurrent partial updates, persistence and broadcasts without stopping capture, preserving comment drafts/edits, failed-save recovery, updating the existing overlay, rescheduling queued requests and preserving provider cooldowns. Local rendering of the actual panel module was checked at 650 px and 320 px. Browser automation cannot click inside its closed shadow root, so selection behavior is covered by offline UI tests; real YouTube interaction with the updated controls remains pending.


## Queue recovery and panel controls (0.1.13, October 9)

A local browser run of the production queue reproduced `TypeError: Illegal invocation` after the first job. Calling a native browser timer as a queue instance method supplied an invalid receiver. Wrapping the native timer calls fixed the reproduction: both consecutive jobs finished. This is browser evidence for the scheduler defect, not an end-to-end provider test.

The 119 passing offline tests include atomic comment/back-translation ordering, cancellation between stages, full retry while active, matching progress messages, stale-response suppression, a two-minute comment timeout, bounded overflow recovery, caption quota/transient-error cooldown and resumption, minimum one-second notices, timing settings and minimization preserving state. No overflow-count reset control was added; resetting the lane would discard valid work and could bypass quota cooldowns.

Local screenshots verify the actual panel at 650 px and 320 px, including the header minimize button, timing selectors and permanent Retry all. Closed shadow DOM prevents the browser tool from clicking these controls; their interaction checks use the offline UI harness. Updated Chrome/YouTube capture, actual provider limits, manual MTL edits during live captions and recovery after real service errors remain pending. No real API or chat-posting requests were made for these checks.


## Native timer and stale-context follow-up (0.1.15)

The user supplied a stack at `TranslationQueue.nextRequest` line 37: native timer invocation during the back-translation gap. The 0.1.14 default-wrapper path passed a local six-second browser/Worker test, so that alone did not reproduce the user's configuration. Supplying actual native timer functions to the old constructor did reproduce Illegal invocation at that same line in a browser Worker. The new constructor explicitly supplies the browser global as receiver for every injected/default timer. That reproduction passes after the fix. This covers the observed failing operation; the reason the user's running instance retained a native timer is not yet established.

All 124 offline tests pass, including timer exceptions on a repeated back-translation wait and queued dispatch, recovery of subsequent work, synchronous CANCEL failure, and extension-context invalidation. A local actual-composer/background-worker harness completed translation, back-translation and manual-MTL back-translation with mocked provider responses. No real provider requests were made. End-to-end confirmation in the user's installed extension remains pending.

Stage diagnostics contain only the operation name and local extension stack locations, never comment text or API keys. The separately reported Extension context invalidated error now stops stale observation and communication, leaves the draft visible and makes the old panel read-only until reload.


## Code-review follow-up (0.1.16)

Both findings in the October 9 review of 0.1.15 are addressed. The OpenAI/DeepL STT base adapter now invokes default and supplied fetch functions with the browser global receiver. Settings saves now update existing translation lanes as well as persisted settings.

All 132 offline tests pass. Added checks cover both STT adapters with receiver-sensitive default/supplied fetch, Settings changes from 500 to 12000 ms and back, and preserving a 30-second provider cooldown across a save. The interval tests exercise the production background handler and scheduler using a virtual clock and mock provider transport.

A local Chromium check reproduced Illegal invocation with the old instance-style native fetch call. The updated OpenaiStt and DeeplStt fetch wrappers both read a data URL successfully. This verifies native calling conventions, not live STT connections: no external API, audio capture or chat posting was used. Real provider-account validation remains pending.
