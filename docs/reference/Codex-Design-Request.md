# Original design request for Codex

[日本語の原文](Codex-Design-Request.jp.md) · [Current implementation](../../README.md)

Historical handoff text, retained as a reference rather than a current implementation task.

Read the attached [KeroTranslate specification](KeroTranslate-Spec.md) and design a Chrome extension proof of concept.

This specification organizes earlier Chat discussions for design work. Distinguish inherited requirements, discussion proposals, new design supplements and unresolved decisions. Do not present supplements as earlier agreements.

Initially target YouTube Live, English↔Japanese and BYOK. Design STT/translated captions for stream audio and assistance with writing comments. The comment UI has Original / MTL / re-MTL, with INSERT from Original and MTL into YouTube's native input. **INSERT is not SEND. The extension must not post; the user performs the final POST/Enter in YouTube's native UI.** re-MTL is read-only assistance for checking meaning, not a guarantee of translation quality.

Captions offer original only, translation only or both, with a 3×3 position selector. Keep STT and translation in independently selectable provider adapters. Consult the specification for candidates and verify APIs, connection methods, pricing and free allowances against official documentation at implementation time.

First provide:

1. PoC implementation scope and UI proposals for captions, composer and settings.
2. MV3 architecture, audio capture and the YouTube integration boundary.
3. Revisions across Original/MTL/re-MTL, STALE results, asynchronous responses, errors and Stop.
4. Provider feasibility and implementation/comparison order.
5. Recommended approaches to open decisions and items requiring a decision.
6. Implementation stages, acceptance criteria and ways to measure latency/API usage.

Explain technical choices and proceed with reversible details without repeatedly asking questions. Refine the UI by examining a working prototype. If a repository already exists, inspect its state and working rules first.

Do not expand the PoC into OBS, hosted infrastructure, training-data collection, shared Community Dictionary infrastructure, an independent MEOW Editor or an AI VTuber. Leave extension points only. Free/Paid prices and limits remain undecided.

The first deliverable is a design and implementation plan. In a working UI prototype, identify actual API integrations versus sample data and do not claim unverified features work.
