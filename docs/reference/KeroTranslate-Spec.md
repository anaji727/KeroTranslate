# KeroTranslate — original design handoff specification

[日本語の原文](KeroTranslate-Spec.jp.md) · [Current implementation](../../README.md)

Names were standardized following the October 7, 2026 decision. This is the original feature proposal, not the current implementation status.

Created October 6, 2026 JST. Version 0.1, organizing earlier discussions for design work. Scope: a Chrome extension PoC; this document does not certify that features are implemented.

## 1. Reading this document and sources

This reorganizes Kero-related content from earlier Chat discussions and detailed handoff material brought to the next chat. It is not a verbatim reconciliation of every message.

- **Inherited requirements:** policies/specifications recorded in the handoff.
- **Discussion proposals:** candidates from earlier discussions, not final decisions.
- **New design supplements:** details such as state handling and acceptance criteria added to make design actionable, not prior agreements.
- **Open decisions:** matters the material alone does not settle.

Main source records:

1. [Handoff completion report](https://chatgpt.com/c/6abfc934-74cc-83e9-a021-f80ecffff268), initial attached text headed “Handoff for the next thread / late night October 2, 2026.” Referenced sections cover KeroTranslate, PoC, providers, pricing, UI/UX, overlays, dictionaries and Streamer Plan.
2. [Thread migration confirmation](https://chatgpt.com/c/6aba4a84-b388-83e8-9246-e54e5289033b), also labeled “20261003” in retrieved material, for release explanations, STT/MTL/re-MTL, BYOK and keeping the initial system small.

The official name is KeroTranslate across the repository, product UI and included documents.

## 2. Product purpose

**A Chrome extension for understanding YouTube Live audio, quickly drafting comments in another language, reviewing them and posting manually.**

The main audience is English-speaking viewers of Japanese VTubers. Support English→Japanese and Japanese→English, including streams where both languages occur. Provide transcription/translated audio captions and translation of the viewer's own comments.

The value is reducing effort and uncertainty between watching and commenting, beyond simply invoking a translation API. Seconds matter in live chat; keep frequent actions few and processing states easy to understand.

Position it as a small tool for stream-side comments, not a broad international-community platform. Prefer an English-first UI. Use the frog as the public brand and the cat for future dictionary/developer assistance.

Earlier example copy: “KeroTranslate — It's a handy little tool to help with your comments.”

## 3. PoC scope

### 3.1 Inherited requirements

| Area | Scope |
|---|---|
| Runtime | Chrome extension, Manifest V3 |
| Service | YouTube Live |
| Languages | English and Japanese, both directions |
| Incoming | Stream audio → STT → translation → video overlay |
| Outgoing | User's Original → MTL → re-MTL → INSERT into native input |
| Posting | User operates YouTube's native UI |
| API use | BYOK, the user's own keys |
| Providers | Separate STT/translation, selectable in settings |
| Dictionary | Small local JSON if needed initially |
| Pricing direction | Limited FreeUse and inexpensive BYOK Paid; figures/payment method undecided |
| Collection | No translation-data collection for quality improvement in the PoC |

### 3.2 Exclusions

- OBS integration or a production Streamer Plan.
- Hosted translation, developer-funded API allowances or hosted billing.
- Automatic translation of every viewer's comments.
- Automatic posting or proxy execution of native POST.
- Shared/public Community Dictionary infrastructure or an independent MEOW Editor.
- Training-data collection, a proprietary translation model or training pipeline.
- An AI VTuber, Persona, Live2D or ComfyUI integration.
- A full freely draggable caption-positioning system.

Retain Free/Paid as a product concept, but the new design supplement does not require payment services to validate the PoC. Decide separately what billing belongs in a distributed beta.

## 4. User flows

### 4.1 Understand the stream

1. Open YouTube Live.
2. Select STT/translation providers, required keys and language settings.
3. Explicitly start capture.
4. Transcribe audio and translate into the target language.
5. Overlay Original, MTL or both.
6. Move captions using nine positions if they obscure content.
7. Stop audio capture and new API work when finished.

Specific start/stop behavior is a new design supplement. Capturing only the target tab and handling mixed Japanese/English are technical validation items.

### 4.2 Comment

1. Enter text in Original.
2. Generate MTL when typing settles.
3. Read re-MTL, translated back into the original language, to spot major meaning changes.
4. Click Original or MTL INSERT.
5. Put the selected text into YouTube's native input.
6. The user posts via native POST or Enter.

**INSERT and POST are separate. Kero does not post.** Back-translation is a quick sanity check, not a quality certificate or correctness judgment.

## 5. Composer UI

### 5.1 Inherited / leading layout proposal

Keep native chat roughly in the upper two-thirds and place the composer in the lower third. This is a design guide, not a fixed ratio on small screens.

```text
YouTube native live chat — other viewers' messages unchanged
-----------------------------------------------------------
EN ↔ JA       Provider       State
Original [editable user text]                    [INSERT]
MTL      [translated text]                       [INSERT]
re-MTL   read-only meaning check
-----------------------------------------------------------
Native YouTube input [POST] and native emote panel
```

Original INSERT also serves users writing directly in their intended language. MTL INSERT uses translated text. re-MTL has no INSERT and should not look like an editable input. Suggested copy: “Insert into YouTube chat input. Does not send.” Display direction/provider/state briefly; keep API-key details behind settings. Preserve native chat reading, posting and emotes.

### 5.2 Unsettled interactions

Earlier material did not settle direct MTL editing. The new recommendation is to allow it and regenerate re-MTL, while editing Original remains an alternative.

For existing native drafts, the recommendation is immediate insertion when empty and an explicit replace/keep choice otherwise. Prevent duplicate insertion on repeated clicks. The inherited material did not settle this behavior.

### 5.3 Prevent stale translation use — new supplement

Bind Original, MTL and re-MTL to the same revision. Changes to input, direction or provider mark results stale; late responses cannot overwrite current results.

| State | Display / behavior |
|---|---|
| EMPTY | No original; no translation request |
| EDITING / STALE | Editing or old results; disable MTL INSERT |
| TRANSLATING | Translate current Original |
| BACK_TRANSLATING | Current MTL available; re-MTL pending |
| READY | Matching MTL and re-MTL complete |
| ERROR | Identify failed stage, preserve Original and permit retry |

Original INSERT can work when nonempty and the target is available. Whether MTL INSERT must wait for re-MTL was open; initially recommend waiting for READY, then compare responsiveness in real use. Debounce, timeouts and retry counts were not agreed numbers; measure before fixing them. Do not translate intermediate Japanese IME composition.

## 6. Audio and captions

### 6.1 Inherited requirements

Overlay STT source and translated text. Choose MTL only / Original only / Original + MTL, one or two lines, and a 3×3 anchor grid:

| | Left | Center | Right |
|---|---|---|---|
| Top | TL | TC | TR |
| Middle | ML | MC | MR |
| Bottom | BL | BC | BR |

One-click movement takes priority over coordinates because avatars/game UI vary by stream.

### 6.2 Discussion proposals

Font size, maximum width, margins and original/translation order. Free placement may belong to a future Streamer Plan, not the PoC.

### 6.3 New supplements / validation

- Distinguish partial and final STT; compare translation-trigger timing against latency/API use.
- Associate original/translation by utterance ID despite response reordering.
- Distinguish start, stop, denied permissions, no speech and provider errors.
- Verify that stream audio remains audible during capture.
- Prevent old captions/requests surviving navigation, closure or Stop.
- Use Japanese/English switching as a core evaluation case; compare fixed, automatic and mixed recognition.
- Retention, character limits, wrapping, history and fullscreen scope remain open.

## 7. Providers and keys

### 7.1 Inherited requirements

Separate STT and translation into adapters such as `ISttProvider` and `ITranslationProvider`, selectable through settings. Retain BYOK provider choice in future versions.

| Role | Earlier candidates, not confirmed selections |
|---|---|
| Translation | DeepL, OpenAI, Gemini |
| STT | Azure Speech, Groq Whisper, OpenAI, Deepgram, Local Whisper |

Adapting every candidate for comparison was discussed. There was no agreement to restrict the first release to exactly two companies, nor a requirement to implement every candidate to pass the PoC. Propose order and comparison scope.

Evaluate Local Whisper/faster-whisper separately; do not assume extension-only execution. If a helper process is required, document that architecture. This handoff did not verify free allowances, prices, APIs or browser connectivity. Verify official sources during implementation; old discussion figures are not settled facts.

### 7.2 New supplements

- Decouple UI, YouTube-specific code and provider SDKs.
- Handle STT/translation keys separately.
- Never expose keys in YouTube DOM, messages, routine logs or settings exports.
- Specify storage, persistence, deletion and execution boundaries; storage alone is not secure encrypted custody.
- Make processing destinations and active providers understandable.
- Do not automatically switch to a different paid provider; any fallback must remain within user choices.
- Distinguish authentication, quota, rate-limit, network and timeout errors.
- Distinguish sending audio/text to providers from Kero collecting data for improvement. BYOK does not necessarily mean offline.

## 8. Architecture and YouTube integration

Earlier proposals used an extension-owned container/Shadow DOM rather than rewriting all YouTube DOM/CSS. A LIVE CHAT | KERO tab switch was considered, but the native-chat-plus-composer layout became the leading proposal.

The initial recommendation is an added composer with its own container and a YouTube adapter boundary:

```text
YouTube / capture → STT adapter → utterance events → translation core → captions
Composer Original → translation core → MTL → back-translation → re-MTL
User INSERT → YouTube chat adapter → native input
Settings / provider registry / minimal local dictionary → configuration
```

Specify content scripts, worker and audio runtime in the design deliverable. This handoff is not a verified MV3 API feasibility document.

Check frame boundaries/insertion, SPA navigation, chat reload/DOM reconnection, preserving emotes/drafts, safe failure on unsupported pages or unknown targets, minimal permissions and current YouTube terms. INSERT-only operation does not by itself prove compliance.

An output boundary such as `onTranslation(...)` is enough for future destinations. Do not build an OBS server in the PoC.

## 9. Dictionaries and future concepts

### 9.1 Initial dictionary

Small local JSON is acceptable. Begin with limited needs such as preserving proper names or specifying translations. Format, precedence and application timing remain undecided.

### 9.2 After the PoC

| Concept | Purpose |
|---|---|
| Community Dictionary | Create/share streamer, work or game dictionary packs |
| Automatic pack selection | Load by channel ID |
| MEOW Editor | Independent dictionary editor |
| Developer (MEOW) Mode | Raw STT, latency, language detection, events and logs |
| Hosted Free / Contributor | Limited included API allowance and explicit opt-in improvement data |
| Hosted Paid | Included API independent of data-sharing consent; operator-selected providers envisioned |
| Streamer Plan | OBS/API, captions, stream management, dictionaries, moderator sharing and multilingual support |
| Proprietary models | Consider dictionaries, then lightweight rewriting/re-evaluation, then domain translation |

Possible dictionary fields include term, source/target languages, translate/preserve/replace mode, priority, optional regex, channel scope, author and version. Not all belong in the first JSON format.

The intention was to retain BYOK Paid after Hosted arrives. Prices, time limits, feature differences and billing units remain open. Potential future training records include originals, translations, corrections, provider/dictionary versions and video/channel context, but the PoC collects none. INSERT text may differ from the final posted message; do not claim observation without a defined method.

## 10. Acceptance criteria — new supplement

No numeric performance targets were established in earlier discussion. Measure first, then judge.

| ID | Scenario | Pass condition |
|---|---|---|
| A01 | Enter Japanese/English Original | Requested MTL and matching re-MTL |
| A02 | Original INSERT | Original enters native input without posting |
| A03 | MTL INSERT | Current translation enters native input without posting |
| A04 | Interact with re-MTL | Read-only, no INSERT |
| A05 | Rapid edits | Old responses cannot appear/be inserted as current |
| A06 | Japanese IME | Avoid requests during composition |
| A07 | Bad key/rate limit/network failure | Clear failed stage; preserve Original and allow retry |
| A08 | Change providers | Independently switch implemented STT/translation adapters |
| A09 | Capture audio | Hear the stream while using STT/translated captions |
| A10 | Caption settings | Three modes and nine positions work |
| A11 | Stop/navigation | No old audio/results leaking into another video |
| A12 | Existing draft | Follow chosen insertion policy without silent erasure |
| A13 | Native YouTube features | Reading, native posting and emotes remain usable |
| A14 | Inspect transfers/storage | No unnecessary destinations or Kero improvement collection |
| A15 | Mixed-language stream | Record recognition failures, quality, latency and cost; explain limitations |

Measure time to STT final, STT→MTL, settled input→MTL→re-MTL, API usage and effort to INSERT. Fluent back-translation alone does not establish correctness.

## 11. Decisions for the design phase

| Topic | Status in the handoff |
|---|---|
| Official name | KeroTranslate, standardized October 7 |
| UI framework/language/build | No prior agreement; propose with reasons |
| First providers | Select candidates and propose comparison scope |
| Incoming language detection | Evaluate mixed speech, then choose auto/fixed options |
| MTL/re-MTL providers | Same/separate selection undecided |
| Direct MTL editing | Recommended; decide adoption and retranslation trigger |
| INSERT before re-MTL | Compare speed and mistake prevention |
| Draft insertion | Decide replace/append/confirmation |
| Caption boundaries/retention/wrapping | Specify through measurement |
| Supported layouts | Normal watch baseline; explicitly state fullscreen/theater/pop-out scope |
| Key storage | Design lifetime, boundary and deletion |
| Free/Paid | Prices, limits and introduction timing undecided |
| Dictionary | Propose minimal format and provider-specific application |
| Distribution | Propose local loading, alpha distribution and store-publication stages |

Not every item requires a user question. Proceed with recommended reversible technical choices, while marking product scope, pricing, posting behavior and other consequential open decisions explicitly.

## 12. First requested design deliverables

This handoff starts design work; it does not request implementing all future concepts at once.

1. Understood PoC scope and exclusions.
2. UI proposals for video captions, composer and settings.
3. Extension runtimes, capture, providers and YouTube adapter architecture.
4. Input revisions, asynchronous results, stale/error/stop states.
5. Provider feasibility, first working combination and comparison order.
6. Recommendations and decisions still needed.
7. Staged implementation, checks and measurements.

Prioritize a visible, editable UI prototype. Distinguish design assumptions from verified behavior; do not label non-working parts as implemented.
