# Your first API keys: Deepgram + Gemini

[日本語](API-KEYS.jp.md) · [Back to README](../README.md)

No programming is needed: **create a key for each service, then paste it into KeroTranslate's settings**. The maintainer has tested this combination using Deepgram's free credits and Gemini's free tier.

## What is an API? Why do I need a key?

An API lets an app ask an external service to do work. KeroTranslate uses external services to turn stream audio into text and translate it. **An API key is a private access key that lets the extension use a service through your account.** It is issued separately from your login password.

| Service | Its job in KeroTranslate | What you need |
|---|---|---|
| **Deepgram** | Turns stream audio into text. **STT** means speech recognition. | A Deepgram account and API key |
| **Gemini** | Translates captions and comments, then translates back for re-MTL. | A Google account and Gemini API key |

For comment translation alone, start with the Gemini key. Add Deepgram for audio captions. With this combination, tab audio goes to Deepgram; recognized text, comments and translations go to Gemini.

## 1. Create a Deepgram key

1. Open the [Deepgram Console](https://console.deepgram.com/) and register or sign in.
2. Select your project at the top-left, then **Settings → API Keys → Create a New API Key**. A project groups keys and usage; one is created when you register.
3. Name the key `KeroTranslate`. If asked for a permissions role, choose **Member**; choose an expiry appropriate for your use, then **Create Key**. [Official role reference](https://developers.deepgram.com/guides/deep-dives/working-with-roles)
4. Copy and securely keep the key. **Its full secret cannot be displayed again.**

Use the key itself, not its name or project ID. If labels have changed, follow [Deepgram's key creation guide](https://developers.deepgram.com/docs/create-additional-api-keys).

## 2. Create a Gemini key

1. Open [Google AI Studio's API keys page](https://aistudio.google.com/apikey), sign in with Google, and review the initial terms if prompted.
2. Use the automatically created key, or select **Create API key** and select/create your own project as needed.
3. Copy the key. If an existing project is missing, use **Projects → Import projects**.
4. To try the free tier, check that the project's billing tier is **Free Tier**. You do not need to proceed through **Set up billing** to upgrade it.

[Google's key creation guide](https://ai.google.dev/gemini-api/docs/api-key) · [Free tier and billing](https://ai.google.dev/gemini-api/docs/billing)

## 3. Add the keys to KeroTranslate

Open **Settings & API keys** from the Chrome toolbar icon, or use the main panel's gear button.

| Setting | Select or paste |
|---|---|
| **Speech to text** | **Deepgram** |
| **Deepgram API key** | Your key from step 1 |
| **Translation + re-MTL** | **Gemini** |
| **Gemini API key** | Your key from step 2 |
| **Gemini model ID** | Try the default first. If unavailable, check which model IDs your API project supports. |

Click **Save settings**. Keys survive Chrome restarts in the same profile and extension installation. Saving settings stops active caption capture; restart it if needed.

First, type a short comment into Original and check that MTL and re-MTL appear. For captions, play a YouTube Live stream with audio and use **the KeroTranslate toolbar icon → Start captions** on that tab. You do not need to post a chat message to test it.

## Free usage and common problems

| Item | What to know |
|---|---|
| Deepgram free usage | Uses a credit balance. At the date checked, the offer is $200 in signup credits, not unlimited usage or a monthly refill. [Current pricing and conditions](https://deepgram.com/pricing) |
| Gemini free usage | Free Tier covers eligible models within usage limits. Availability and limits depend on the model and project. [Pricing](https://ai.google.dev/gemini-api/docs/pricing) · [Checking active limits](https://ai.google.dev/gemini-api/docs/rate-limits) |
| Invalid key / authentication error | Check the correct service's field, complete key text and expiry. |
| Rate-limit / quota error | Check remaining credits and limits. Wait as instructed; for request-rate limits, try [adjusting Request gap](../README.md#shared-request-scheduling). Spacing cannot replenish an exhausted allowance. |
| Lost or exposed key | Revoke/delete it in the service's console, create a replacement and save that in the extension. |

**Treat keys like passwords: never post them in chat, GitHub or public screenshots.** Gemini's free tier may use inputs and outputs for service improvement; review [Google's pricing and data-use information](https://ai.google.dev/gemini-api/docs/pricing) and avoid confidential content.

Official instructions and pricing checked October 10, 2026. Screens and free allowances can change. The tested combination refers to the maintainer's environment, not every account or model.
