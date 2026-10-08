# KeroTranslate 0.1.6 — additional providers

[日本語](PROVIDERS-0.1.6.jp.md) · [Current README](../README.md)

Historical integration note dated October 7, 2026. The implementation was based on provider documentation and tested with simulated traffic. Live account connections, billing, quality and stream latency were not verified. Endpoint and model names below describe the code, not a guarantee of current account access.

## Implemented routes

| Selection | Endpoint | Behavior |
|---|---|---|
| OpenAI translation | `https://api.openai.com/v1/responses` | Configurable model, default `gpt-4.1-mini`; `store:false`; accept completed assistant text only |
| OpenAI STT | `https://api.openai.com/v1/realtime/calls` + WebRTC | `gpt-live-transcribe`, transcription-only session; deltas become partials and completed events become finals |
| DeepL translation | `https://api-free.deepl.com/v2/translate` or `https://api.deepl.com/v2/translate` | Explicit Free/Pro selection; autodetect caption language, use explicit direction for comments |
| DeepL STT | `https://api.deepl.com/v3/voice/realtime` + `wss://api.deepl.com/v3/voice/realtime/connect` | Request source transcription only; mono WebM/Opus in 200 ms chunks; map tentative/concluded text to display events |
| DeepSeek translation | `https://api.deepseek.com/chat/completions` | Configurable model, default `deepseek-flash`; Thinking disabled; accept normally completed content only |

STT and translation are separate selections. Even with the same company selected for both, finalized recognition text is translated in a separate request. With different providers, the recognized source text also goes to the translation provider. No DeepSeek STT route is implemented.

## Segmentation and ordering

The implemented OpenAI live-model configuration uses local Web Audio amplitude-based endpointing rather than server VAD. Commit after about 600 ms of quiet, or eight seconds of continuous sound. Clear the buffer after ten seconds without detected speech. These experimental thresholds do not distinguish speech from background music and can misclassify music or quiet speech. Partials appear before commit; translation is requested only after finalization.

Order is tracked by OpenAI item ID so a late old final does not rewind the newest pending caption. For DeepL, combine concluded text into one segment and display new tentative text as the next segment. Its finalization boundary may not be a sentence boundary; sentence merging remains future work.

## Keys, connections and Stop

This is a personal bring-your-own-key extension, not a distribution containing a shared application key. Long-lived keys stay in trusted extension contexts and are never passed to YouTube's DOM or content scripts. OpenAI WebRTC initialization authenticates directly from the offscreen document; there is no application relay server.

DeepL Voice uses a short-lived connection token in its WebSocket URL, following the integration design. Validate the returned endpoint's origin and path against a fixed allowlist. Do not expose that URL or token in UI or metrics. Long-lived API keys use HTTP headers.

Host permissions and CSP include only the official hosts used by the adapters. DeepL connections from trusted extension contexts still require real-browser validation; ordinary webpage CORS restrictions are a separate concern. No unofficial proxy is used.

Stop, settings changes and key deletion end recognition and audio processing and abort initialization HTTP calls. Late responses must not open new connections. Connection failures require manual restart; the extension never automatically switches to another billable provider. Already-sent work can still be charged.

## Validation

At 0.1.6, 76 offline tests passed. New coverage included endpoints, authentication, response parsing, rejecting incomplete output, DeepL Free/Pro routing, separating billed characters from tokens, cancellation, STT partial/final ordering, Stop races, backpressure, endpoint validation and key isolation. Syntax and distribution generation were also checked.

For live validation:

1. Reload the extension and YouTube; re-enter the required keys. Check that the added host permissions are active.
2. Test a short sentence in each translation direction and re-MTL after editing MTL. For DeepL, match the Free/Pro plan to the key.
3. Start STT in Original only mode for about ten seconds. Check partials, finals, continued audible playback and capture termination after Stop.
4. Add translation and check the previous translated caption alongside newer partials. For OpenAI, test silence, continuous sound, music and quiet speech.
5. Test Stop, saving settings, deleting keys, navigation and network loss while connecting or translating. Compare usage against provider dashboards.

Current metrics do not count OpenAI WebRTC bytes or STT tokens. DeepL translation reports `billedCharacters`; other translation adapters aggregate returned token usage. These are partial session aggregates, not billing meters.

## Official references used for the integration

- [OpenAI text generation](https://developers.openai.com/api/docs/guides/text)
- [OpenAI Realtime transcription](https://developers.openai.com/api/docs/guides/realtime-transcription)
- [OpenAI WebRTC connection](https://developers.openai.com/api/docs/guides/voice-webrtc?voice-api=realtime)
- [DeepL text translation](https://developers.deepl.com/api-reference/translate/request-translation)
- [DeepL Voice quickstart](https://developers.deepl.com/docs/voice/real-time-voice-quickstart)
- [DeepL Voice session / supported formats](https://developers.deepl.com/api-reference/voice/request-session)
- [DeepSeek Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/)
