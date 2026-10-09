# Comment translation latency experiment — Beta 0.1.17

[日本語](LATENCY-0.1.17.jp.md) · [README](../README.md)

Tested October 9, 2026. These are virtual-clock measurements of the production background handler, queue and Composer, with simulated provider and browser-frame response times. They are not live API latency measurements or a translation-quality evaluation. No real API requests were made.

## Adopted change

The worker used to await delivery of the MTL progress notification to YouTube before starting the back-translation wait. It now sends that notification without blocking. The request gap and provider cooldown still apply; the second API call still translates the actual MTL. A late progress notification is ignored once its comment operation has ended. Notification rejection or a synchronous failure cannot stall back-translation.

The following times cover the comment batch only; add the unchanged 650 ms input debounce. There is no pre-existing caption request in these scenarios.

| Simulated condition | API time per stage | Request gap | Progress acknowledgement delay | Before | After | Saved |
|---|---:|---:|---:|---:|---:|---:|
| Responsive frame | 1.2 s | 1 s | 0 s | 2.40 s | 2.40 s | 0 s |
| Busy frame | 1.2 s | 1 s | 0.75 s | 3.15 s | 2.40 s | 0.75 s |
| Fast API, busy frame | 0.4 s | 1 s | 0.75 s | 1.55 s | 1.40 s | 0.15 s |
| Longer configured gap | 1.2 s | 6 s | 0.75 s | 7.20 s | 7.20 s | 0 s |

Each case sends exactly two translation requests before and after. The improvement depends on frame delivery being a bottleneck; a responsive frame sees no reduction. API processing time itself is unchanged.

## Rejected experiment

Reducing the typing debounce from 650 to 350 ms started translation 300 ms earlier after a final keystroke. But a replay with a 500 ms mid-sentence pause triggered two comment batches instead of one. That can waste quota and delay other work, so the default remains 650 ms. No model, prompt, output limit or saved setting was changed.

## Practical tuning

If Request gap is still 6 s, it imposes a significant floor on the two-stage comment flow. For a 1.2 s response per stage, the simulated batch takes 7.2 s with a 6 s gap versus 2.4 s with a 1 s gap; typing debounce and any active caption request add waiting. One second is the default, but use a gap your provider allowance supports. A lower gap cannot fix API processing delays or quota exhaustion.

Gemini's documented default for the extension's default `gemini-3.5-flash-lite` model is already minimal thinking, so forcing that same setting is not an evidenced speedup. The configured model in the user's current session was not confirmed. [Google's thinking documentation](https://ai.google.dev/gemini-api/docs/thinking)

## Validation

132 offline tests pass. A regression test leaves the frame notification unresolved and confirms the two-stage operation still completes with pacing. Another path throws during notification delivery; edited-MTL back-translation still completes. The content test verifies that late progress cannot overwrite a finished result. Existing cancellation, quota, queue ordering, IME and stale-response tests remain in place. Real YouTube/provider latency remains unmeasured in this experiment.
