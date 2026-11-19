# Voice Translator (RenSlate)

A zero-dependency, installable web app that transcribes speech, translates it, and reads the result aloud.

## Run locally

- Double-click `start.bat` (Windows), or run `npm start`, or `node server.js`.
- Open <http://localhost:8080/index.html>.
- Voice recognition works best in Chrome or Edge on desktop/Android. Typed translation works in any modern browser.

Optional server environment variables: `PORT`, `HOST`, `NO_OPEN=1` (disable auto-opening the browser).

## Features

- Speech-to-text via the Web Speech API with a live waveform from the Web Audio API.
- Translation via the free MyMemory API (no API key), with chunking for long passages.
- Text-to-speech for the translated result, with language-matched voices.
- 20 languages with RTL support for Arabic and Hebrew.
- Auto-translate while typing, Enter to translate immediately, language presets, and swap.
- Local history (10 entries), copy/retry/delete actions, and per-item reload.
- Offline app shell via a service worker, plus an installable PWA manifest and icons.
- Dark / Light / System themes and keyboard-accessible controls.

## Voice input on a phone (important)

- Web Speech Recognition and the microphone **only work on HTTPS** (or `localhost`). Installing from a plain `http://192.168.x.x` address will silently break voice input. Use an HTTPS tunnel (for example Cloudflare Tunnel or ngrok) or serve over HTTPS.
- Chrome/Android ends speech sessions early. The app now automatically restarts the session while the mic button is active, so keep holding the conversation until you tap stop.
- Speech recognition sends audio to Google's service, so the phone needs an internet connection. `network` errors mean connectivity, not a code bug.
- If voice still fails, open **Settings → Speech Diagnostics**, tap the mic once, and copy the report. It shows secure-context status, permission state, the real browser error code, and recognition events.

## Notes

- Translation requires an internet connection; the app shell is cached for offline use.
- The microphone needs a secure context (`localhost` or HTTPS).
- No build step and no third-party packages are required.
