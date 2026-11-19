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

## Notes

- Translation requires an internet connection; the app shell is cached for offline use.
- The microphone needs a secure context (`localhost` or HTTPS).
- No build step and no third-party packages are required.
