# Partial captions — 0.1.4

[日本語](PARTIAL-CAPTIONS-0.1.4.jp.md) · [Current installation instructions](../README.md)

Historical release note. The standalone preview described here was removed in Beta 0.1.10.

As soon as STT produces a partial result, show the original caption in a dim color with an ellipsis. Revisions replace the same segment in place. A final result switches to normal color without the ellipsis. Only final results trigger translation API requests.

Keep the previous original/translation pair visible and show newer recognition on a separate row with a divider. Segment sequence numbers prevent late translations from erasing newer partial or final recognition. When that segment's translation arrives, merge its provisional row into the translated caption. Existing size and line-count settings also apply to the provisional row.

Partial text is visible in **Original + MTL** and **Original only**. **MTL only** hides it. Pending-translation retention, reading time after translation and immediate clearing on Stop are preserved.

The former standalone preview played partial → revised partial → final → translation samples. Their timing was illustrative, not a latency measurement.

This change concerns display and event delivery. Configurable VAD endpoints, merging subsequent utterances, entity normalization and per-stage latency display remain future work.

Offline validation covered partial/final differentiation, updates within a segment, coexistence of delayed translations and newer partials, restart behavior, discarding responses after Stop, and avoiding translation requests for partials. Live display after the update was not yet verified.
