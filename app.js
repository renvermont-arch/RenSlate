/**
 * Voice Translator Web App
 * Pure vanilla JavaScript - no frameworks, no build tools, no API keys.
 *
 * Sections:
 * 1. Constants & DOM Elements
 * 2. State Management
 * 3. Language Configurations & Mappings
 * 4. Shared UI Helpers
 * 5. Speech Recognition (STT)
 * 6. Waveform Visualizer (Web Audio API)
 * 7. Translation API (MyMemory)
 * 8. Text-to-Speech (TTS)
 * 9. History Management (localStorage)
 * 10. Navigation, Settings & Theme
 * 11. Event Listeners & Initialization
 * 12. Service Worker Registration (PWA)
 */

// ==========================================================================
// 1. CONSTANTS & DOM ELEMENTS
// ==========================================================================

const HISTORY_STORAGE_KEY = 'voice_translator_history_v1';
const THEME_STORAGE_KEY = 'voice_translator_theme_v1';
const HISTORY_LIMIT = 10;
const TRANSLATION_TIMEOUT_MS = 12000;
const TRANSLATION_CHUNK_SIZE = 480;
const AUTO_TRANSLATE_DELAY_MS = 900;
const FINALIZE_FALLBACK_MS = 1500;
const MAX_SPEECH_RESTARTS = 4;
const SPEECH_RESTART_DELAY_MS = 250;
const DIAG_LOG_LIMIT = 40;

const elements = {
  // Navigation & Views
  navItems: document.querySelectorAll('.nav-item'),
  views: {
    voice: document.getElementById('view-voice'),
    history: document.getElementById('view-history'),
    language: document.getElementById('view-language')
  },
  appMain: document.getElementById('app-main'),
  appStatus: document.getElementById('app-status'),
  announcer: document.getElementById('announcer'),

  // Language selectors
  fromLangSelect: document.getElementById('from-lang'),
  toLangSelect: document.getElementById('to-lang'),
  swapLangBtn: document.getElementById('swap-lang-btn'),
  sourceLangLabel: document.getElementById('source-lang-label'),
  toLangLabel: document.getElementById('to-lang-label'),

  // Text cards
  sourceCard: document.querySelector('.source-card'),
  translationCard: document.querySelector('.translation-card'),
  sourceText: document.getElementById('source-text'),
  translationText: document.getElementById('translation-text'),
  clearSourceBtn: document.getElementById('clear-source-btn'),
  translateBtn: document.getElementById('translate-btn'),
  translateBtnText: document.getElementById('translate-btn-text'),
  sourceCharCount: document.getElementById('source-char-count'),
  speakBtn: document.getElementById('speak-btn'),
  speakBtnText: document.getElementById('speak-btn-text'),
  copyBtn: document.getElementById('copy-btn'),
  copyBtnText: document.getElementById('copy-btn-text'),
  retryBtn: document.getElementById('retry-btn'),
  translatingIndicator: document.getElementById('translating-indicator'),

  // Voice recording & waveform
  micBtn: document.getElementById('mic-btn'),
  micStatusLabel: document.getElementById('mic-status-label'),
  waveformCanvas: document.getElementById('waveform-canvas'),
  voiceDock: document.getElementById('voice-controls-section'),

  // History & Settings
  historyList: document.getElementById('history-list'),
  historySubtitle: document.getElementById('history-subtitle'),
  clearHistoryBtn: document.getElementById('clear-history-btn'),
  presetPairsList: document.getElementById('preset-pairs-list'),
  languageGuideList: document.getElementById('language-guide-list'),
  languageCount: document.getElementById('language-count'),
  themeOptions: document.getElementById('theme-options'),
  diagOutput: document.getElementById('diag-output'),
  diagRefreshBtn: document.getElementById('diag-refresh-btn'),
  diagCopyBtn: document.getElementById('diag-copy-btn'),

  // Notification Toast
  toast: document.getElementById('toast')
};

// ==========================================================================
// 2. STATE MANAGEMENT
// ==========================================================================

const state = {
  isRecording: false,
  isStarting: false,
  finalizePending: false,
  finalizeTimer: null,
  isTranslating: false,
  translationController: null,
  translationRequestId: 0,
  typingTimer: null,
  isSpeaking: false,
  speechRecognitionSupported: false,
  recognitionInstance: null,
  audioContext: null,
  mediaStream: null,
  analyserNode: null,
  animFrameId: null,
  history: [],
  toastTimer: null,
  isOnline: navigator.onLine !== false,
  theme: 'dark',
  systemThemeMedia: window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null,
  historyClearArmed: false,
  historyClearTimer: null,

  // Speech session tracking (needed because Android Chrome ends sessions early)
  baseTranscript: '',
  sessionFinalCount: 0,
  restartCount: 0,
  restartTimer: null,
  lastSpeechError: '',
  micPermission: 'unknown',
  diagLog: []
};

// ==========================================================================
// 3. LANGUAGE CONFIGURATIONS & MAPPINGS
// ==========================================================================

/**
 * code:       MyMemory translation API code
 * speechCode: BCP-47 tag for SpeechRecognition and SpeechSynthesis
 * label:      English display name
 * native:     Native display name
 * rtl:        Right-to-left script
 */
const LANGUAGES = [
  { code: 'en', speechCode: 'en-US', label: 'English', native: 'English', rtl: false },
  { code: 'es', speechCode: 'es-ES', label: 'Spanish', native: 'Español', rtl: false },
  { code: 'fr', speechCode: 'fr-FR', label: 'French', native: 'Français', rtl: false },
  { code: 'de', speechCode: 'de-DE', label: 'German', native: 'Deutsch', rtl: false },
  { code: 'it', speechCode: 'it-IT', label: 'Italian', native: 'Italiano', rtl: false },
  { code: 'pt', speechCode: 'pt-BR', label: 'Portuguese', native: 'Português', rtl: false },
  { code: 'ja', speechCode: 'ja-JP', label: 'Japanese', native: '日本語', rtl: false },
  { code: 'ko', speechCode: 'ko-KR', label: 'Korean', native: '한국어', rtl: false },
  { code: 'zh-CN', speechCode: 'zh-CN', label: 'Chinese (Simplified)', native: '简体中文', rtl: false },
  { code: 'tl', speechCode: 'fil-PH', label: 'Filipino', native: 'Tagalog', rtl: false },
  { code: 'ar', speechCode: 'ar-SA', label: 'Arabic', native: 'العربية', rtl: true },
  { code: 'hi', speechCode: 'hi-IN', label: 'Hindi', native: 'हिन्दी', rtl: false },
  { code: 'ru', speechCode: 'ru-RU', label: 'Russian', native: 'Русский', rtl: false },
  { code: 'nl', speechCode: 'nl-NL', label: 'Dutch', native: 'Nederlands', rtl: false },
  { code: 'pl', speechCode: 'pl-PL', label: 'Polish', native: 'Polski', rtl: false },
  { code: 'tr', speechCode: 'tr-TR', label: 'Turkish', native: 'Türkçe', rtl: false },
  { code: 'vi', speechCode: 'vi-VN', label: 'Vietnamese', native: 'Tiếng Việt', rtl: false },
  { code: 'id', speechCode: 'id-ID', label: 'Indonesian', native: 'Bahasa Indonesia', rtl: false },
  { code: 'sv', speechCode: 'sv-SE', label: 'Swedish', native: 'Svenska', rtl: false },
  { code: 'he', speechCode: 'he-IL', label: 'Hebrew', native: 'עברית', rtl: true }
];

const PRESET_PAIRS = [
  { from: 'en', to: 'es', label: 'English ↔ Spanish' },
  { from: 'en', to: 'tl', label: 'English ↔ Filipino' },
  { from: 'en', to: 'ja', label: 'English ↔ Japanese' },
  { from: 'en', to: 'fr', label: 'English ↔ French' },
  { from: 'en', to: 'zh-CN', label: 'English ↔ Chinese' },
  { from: 'en', to: 'de', label: 'English ↔ German' },
  { from: 'en', to: 'ru', label: 'English ↔ Russian' },
  { from: 'en', to: 'hi', label: 'English ↔ Hindi' }
];

function getLanguage(code) {
  return LANGUAGES.find(lang => lang.code === code) || LANGUAGES[0];
}

// ==========================================================================
// 4. SHARED UI HELPERS
// ==========================================================================

/** Refreshes the header status badge based on current app state. */
function refreshAppStatus() {
  let text = 'Ready';
  let className = 'status-badge';

  if (state.isStarting) {
    text = 'Starting…';
    className += ' listening';
  } else if (state.isRecording) {
    text = 'Listening';
    className += ' listening';
  } else if (state.isTranslating) {
    text = 'Translating';
    className += ' translating';
  } else if (!window.isSecureContext) {
    text = 'Needs HTTPS';
    className += ' offline';
  } else if (!state.isOnline) {
    text = 'Offline';
    className += ' offline';
  }

  elements.appStatus.textContent = text;
  elements.appStatus.className = className;
}

/** Announces a message to screen readers without showing it visually. */
function announce(message) {
  elements.announcer.textContent = '';
  if (!message) return;
  requestAnimationFrame(() => {
    elements.announcer.textContent = message;
  });
}

/** Displays a bottom toast notification with auto-dismissal. */
function showToast(message, isError = false) {
  if (state.toastTimer) clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.className = 'toast visible' + (isError ? ' toast-error' : '');
  state.toastTimer = setTimeout(() => {
    elements.toast.className = 'toast';
  }, 3200);
}

/** Enables/disables action buttons and updates their labels. */
function updateActionButtons() {
  const hasSource = Boolean(elements.sourceText.value.trim());
  const hasTranslation = Boolean(elements.translationText.value.trim());

  elements.translateBtn.disabled = !hasSource || state.isTranslating;
  elements.retryBtn.disabled = !hasSource || state.isTranslating;
  elements.speakBtn.disabled = !hasTranslation;
  elements.copyBtn.disabled = !hasTranslation;
  elements.clearSourceBtn.disabled = !hasSource && !hasTranslation;
  elements.translateBtnText.textContent = state.isTranslating ? 'Translating…' : 'Translate';
}

/** Updates the source character counter. */
function updateCharCount() {
  const count = elements.sourceText.value.length;
  elements.sourceCharCount.textContent = `${count} character${count === 1 ? '' : 's'}`;
}

/** Human-readable snapshot of the browser conditions that affect voice input. */
function diagnosticSummary() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

  return [
    `Time:        ${new Date().toLocaleString()}`,
    `Page:        ${location.href}`,
    `PWA mode:    ${isStandalone ? 'yes' : 'no'}`,
    `Secure ctx:  ${window.isSecureContext} (voice input requires true)`,
    `Online:      ${navigator.onLine}`,
    `Speech API:  ${SpeechRecognition ? 'available' : 'MISSING'}`,
    `getUserMedia:${navigator.mediaDevices && navigator.mediaDevices.getUserMedia ? ' available' : ' MISSING'}`,
    `Mic perm:    ${state.micPermission}`,
    `Last error:  ${state.lastSpeechError || 'none'}`,
    `Browser:     ${navigator.userAgent}`
  ].join('\n');
}

/** Rebuilds the diagnostics panel from the current summary and event log. */
function renderDiagnostics() {
  if (!elements.diagOutput) return;
  const events = state.diagLog.length ? state.diagLog.join('\n') : '(no events yet — tap the mic and speak)';
  elements.diagOutput.textContent = `${diagnosticSummary()}\n\n--- events ---\n${events}`;
}

/** Appends a timestamped line to the diagnostics panel. */
function logDiag(message) {
  const time = new Date().toLocaleTimeString([], { hour12: false });
  state.diagLog.push(`[${time}] ${message}`);
  if (state.diagLog.length > DIAG_LOG_LIMIT) state.diagLog.shift();
  renderDiagnostics();
}

/** Queries microphone permission when the browser supports it. */
async function queryMicPermission() {
  if (!navigator.permissions || !navigator.permissions.query) {
    state.micPermission = 'unknown (no Permissions API)';
    renderDiagnostics();
    return;
  }
  try {
    const result = await navigator.permissions.query({ name: 'microphone' });
    state.micPermission = result.state;
    result.onchange = () => {
      state.micPermission = result.state;
      logDiag(`mic permission changed: ${result.state}`);
    };
  } catch (e) {
    state.micPermission = 'unknown (' + (e && e.name ? e.name : 'error') + ')';
  }
  renderDiagnostics();
}

/** Escapes HTML for safe insertion into innerHTML templates. */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==========================================================================
// 5. SPEECH RECOGNITION (STT)
// ==========================================================================

/** Initializes Web Speech Recognition if the browser supports it. */
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    state.speechRecognitionSupported = false;
    elements.micBtn.disabled = true;
    elements.micStatusLabel.textContent = 'Voice input needs Chrome or Edge';
    logDiag('SpeechRecognition is MISSING in this browser.');
    showToast('Speech recognition is not supported in this browser. You can still type text.', true);
    return;
  }

  state.speechRecognitionSupported = true;
  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  state.recognitionInstance = recognition;

  logDiag(`SpeechRecognition available (continuous=${recognition.continuous})`);

  recognition.onstart = () => {
    logDiag('onstart');
    elements.micStatusLabel.textContent = 'Listening… tap to stop';
  };

  // Real-time transcription results. `event.results` is cumulative, so only
  // newly-final results are appended to the session transcript.
  recognition.onresult = (event) => {
    let lastFinalIndex = -1;
    for (let i = 0; i < event.results.length; i++) {
      if (event.results[i].isFinal) lastFinalIndex = i;
    }

    const newFinals = [];
    for (let i = state.sessionFinalCount; i <= lastFinalIndex; i++) {
      const transcript = event.results[i][0] && event.results[i][0].transcript
        ? event.results[i][0].transcript.trim()
        : '';
      if (transcript) newFinals.push(transcript);
    }
    state.sessionFinalCount = Math.max(state.sessionFinalCount, lastFinalIndex + 1);

    const interims = [];
    for (let i = state.sessionFinalCount; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) continue;
      const transcript = result[0] && result[0].transcript ? result[0].transcript.trim() : '';
      if (transcript) interims.push(transcript);
    }

    if (newFinals.length) {
      state.baseTranscript = [state.baseTranscript, newFinals.join(' ')].filter(Boolean).join(' ');
      state.restartCount = 0; // Speech is flowing; reset the auto-restart budget.
    }

    const combined = [state.baseTranscript, interims.join(' ')].filter(Boolean).join(' ');
    logDiag(`onresult final="${newFinals.join(' ')}" interim="${interims.join(' ')}"`);

    if (combined) {
      elements.sourceText.value = combined;
      elements.translationText.value = '';
      updateCharCount();
      updateActionButtons();
      elements.micStatusLabel.textContent = 'Listening… tap to stop';
    }
  };

  // Handles recognition errors
  recognition.onerror = (event) => {
    const code = event.error || 'unknown';
    state.lastSpeechError = code;
    console.warn('Speech recognition error:', code);
    logDiag(`onerror: ${code}`);

    switch (code) {
      case 'not-allowed':
      case 'service-not-allowed':
        abortRecording();
        showToast(`Microphone blocked (${code}). Allow mic access for this site.`, true);
        break;
      case 'audio-capture':
        // A second mic stream (our waveform) may be holding the microphone.
        stopWaveform();
        logDiag('Stopped waveform stream after audio-capture error');
        break;
      case 'network':
        abortRecording();
        showToast(`Speech service needs internet (${code}). Check your connection.`, true);
        break;
      case 'no-speech':
        showToast('No speech heard yet — keep talking, or tap the mic to stop.');
        break;
      case 'aborted':
        break;
      default:
        logDiag(`Unhandled speech error: ${code}`);
    }
  };

  // Chrome on Android frequently ends a session after a short pause even with
  // continuous=true. Restart while the user still intends to record.
  recognition.onend = () => {
    logDiag('onend');

    if (state.finalizePending) {
      finalizeRecording();
      return;
    }
    if (!state.isRecording) return;

    if (state.restartCount < MAX_SPEECH_RESTARTS) {
      state.restartCount++;
      logDiag(`Auto-restarting (${state.restartCount}/${MAX_SPEECH_RESTARTS})`);
      elements.micStatusLabel.textContent = 'Listening… tap to stop';

      clearTimeout(state.restartTimer);
      state.restartTimer = setTimeout(() => {
        state.restartTimer = null;
        if (!state.isRecording || state.finalizePending) return;
        try {
          recognition.start();
          logDiag('restart start() called');
        } catch (e) {
          logDiag(`restart failed: ${e.name}`);
          finalizeRecording();
        }
      }, SPEECH_RESTART_DELAY_MS);
    } else {
      logDiag('Restart limit reached; finalizing');
      finalizeRecording();
    }
  };
}

/** Starts recording and transcribing speech. */
async function startRecording() {
  if (!state.speechRecognitionSupported) {
    showToast('Voice input requires Chrome or Edge. You can type instead.', true);
    return;
  }
  if (state.isStarting || state.isRecording || state.finalizePending) return;

  state.isStarting = true;
  elements.micBtn.disabled = true;
  clearTimeout(state.restartTimer);
  state.restartTimer = null;
  state.baseTranscript = '';
  state.sessionFinalCount = 0;
  state.restartCount = 0;
  state.lastSpeechError = '';
  logDiag('startRecording() called');
  refreshAppStatus();

  try {
    const fromLang = getLanguage(elements.fromLangSelect.value);
    state.recognitionInstance.lang = fromLang.speechCode;
    logDiag(`recognition.lang = ${fromLang.speechCode}`);

    // IMPORTANT: start() must happen inside the tap handler (no await before it).
    // Mobile browsers reject speech recognition started after an async gap.
    state.recognitionInstance.start();
    logDiag('start() called');

    state.isStarting = false;
    state.isRecording = true;
    setListeningUI(true);

    cancelPendingTranslation();
    elements.sourceText.value = '';
    elements.translationText.value = '';
    elements.translationCard.classList.remove('has-error');
    updateCharCount();
    updateActionButtons();
    announce('');

    // The waveform is decorative: a second microphone stream on a phone can
    // interfere with recognition, so only open it on pointer (desktop) devices.
    const isTouchDevice = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (isTouchDevice) {
      logDiag('Waveform skipped on touch device (avoids mic conflict)');
    } else {
      startOptionalWaveform();
    }

  } catch (err) {
    logDiag(`start failed: ${err.name}: ${err.message}`);
    console.error('Error starting recording:', err);
    cleanupRecordingResources();

    if (err.name === 'InvalidStateError') {
      showToast('Microphone is already running. Tap stop first.', true);
    } else if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
      showToast('Voice input is blocked. Open the app over HTTPS and allow microphone access.', true);
    } else {
      showToast(`Could not start voice input (${err.name}). See Settings → Speech diagnostics.`, true);
    }
  } finally {
    state.isStarting = false;
    elements.micBtn.disabled = false;
    refreshAppStatus();
  }
}

/** Opens a microphone stream for the waveform. Failure never blocks dictation. */
async function startOptionalWaveform() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    logDiag('getUserMedia unavailable; waveform disabled');
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    if (!state.isRecording) {
      stream.getTracks().forEach(track => track.stop());
      return;
    }
    state.mediaStream = stream;
    startWaveform(stream);
    logDiag('Waveform microphone stream started');
  } catch (e) {
    logDiag(`Waveform unavailable: ${e.name}`);
  }
}

/** Requests a stop; final transcription is applied when recognition ends. */
function stopRecording() {
  if (!state.isRecording || state.finalizePending) return;

  state.isRecording = false;
  state.finalizePending = true;
  clearTimeout(state.restartTimer);
  state.restartTimer = null;
  stopRecognition();
  stopWaveform();
  setListeningUI(false);

  // Fallback in case the browser never fires `onend`
  if (state.finalizePending) {
    state.finalizeTimer = setTimeout(finalizeRecording, FINALIZE_FALLBACK_MS);
  }
}

/** Idempotent finalization: cleans up and translates the captured text. */
function finalizeRecording() {
  if (!state.finalizePending && !state.isRecording) return;

  clearTimeout(state.finalizeTimer);
  clearTimeout(state.restartTimer);
  state.finalizeTimer = null;
  state.restartTimer = null;
  state.finalizePending = false;
  state.isRecording = false;

  stopRecognition();
  stopWaveform();
  setListeningUI(false);

  const capturedText = elements.sourceText.value.trim();
  if (capturedText) {
    translateCurrentText();
  } else {
    showToast('No speech was detected. Tap the mic to try again.');
  }
}

/** Stops recording without translating (used for errors). */
function abortRecording() {
  clearTimeout(state.finalizeTimer);
  clearTimeout(state.restartTimer);
  state.finalizeTimer = null;
  state.restartTimer = null;
  state.finalizePending = false;
  cleanupRecordingResources();
}

/** Stops the recognition engine, ignoring "already stopped" errors. */
function stopRecognition() {
  if (!state.recognitionInstance) return;
  try {
    state.recognitionInstance.stop();
  } catch (_) {
    // Already stopped - safe to ignore.
  }
}

/** Full, idempotent cleanup of recording resources and UI. */
function cleanupRecordingResources() {
  state.isRecording = false;
  state.isStarting = false;
  state.finalizePending = false;
  clearTimeout(state.restartTimer);
  state.restartTimer = null;
  stopRecognition();
  stopWaveform();
  setListeningUI(false);
}

/** Updates mic button, prompt text, and status badge. */
function setListeningUI(isListening) {
  elements.micBtn.classList.toggle('recording', isListening);
  elements.micBtn.setAttribute('aria-label', isListening ? 'Stop recording speech' : 'Start recording speech');
  elements.micBtn.title = isListening ? 'Tap to stop recording' : 'Tap to start recording';
  elements.micStatusLabel.textContent = isListening ? 'Listening… tap to stop' : 'Tap microphone to speak';
  elements.micStatusLabel.classList.toggle('recording', isListening);
  refreshAppStatus();
}

// ==========================================================================
// 6. WAVEFORM VISUALIZER (Web Audio API on <canvas>)
// ==========================================================================

/** Sizes the canvas backing store for high-DPI displays. */
function resizeWaveformCanvas() {
  const canvas = elements.waveformCanvas;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round((rect.width || canvas.width || 360) * dpr));
  const height = Math.max(1, Math.round((rect.height || canvas.height || 48) * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

/**
 * Starts the Web Audio API AnalyserNode and connects the microphone stream.
 * NOTE: The analyser is never connected to audioContext.destination (no feedback loop).
 */
function startWaveform(stream) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    if (state.audioContext && state.audioContext.state !== 'closed') {
      state.audioContext.close().catch(() => {});
    }

    state.audioContext = new AudioContextClass();
    if (state.audioContext.state === 'suspended') {
      state.audioContext.resume().catch(() => {});
    }

    const source = state.audioContext.createMediaStreamSource(stream);
    state.analyserNode = state.audioContext.createAnalyser();
    state.analyserNode.fftSize = 256;
    source.connect(state.analyserNode);

    resizeWaveformCanvas();
    renderActiveWaveform();
  } catch (err) {
    console.warn('Waveform unavailable:', err);
    state.analyserNode = null;
  }
}

/** Continuously draws the active audio waveform on the canvas. */
function renderActiveWaveform() {
  const canvas = elements.waveformCanvas;
  const ctx = canvas.getContext('2d');
  if (!ctx || !state.analyserNode) return;

  const bufferLength = state.analyserNode.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  const cssWidth = canvas.getBoundingClientRect().width || canvas.width;
  const scale = canvas.width / cssWidth;

  const draw = () => {
    if (!state.isRecording || !state.analyserNode) return;
    state.animFrameId = requestAnimationFrame(draw);

    state.analyserNode.getByteTimeDomainData(dataArray);

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 2.5 * scale;
    ctx.strokeStyle = '#3b82f6';
    ctx.shadowBlur = 8 * scale;
    ctx.shadowColor = 'rgba(59, 130, 246, 0.5)';
    ctx.beginPath();

    const sliceWidth = width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * height) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }

    ctx.stroke();
  };

  draw();
}

/** Draws a calm, subtle flat idle baseline when not recording. */
function drawIdleWaveform() {
  const canvas = elements.waveformCanvas;
  if (!canvas) return;
  resizeWaveformCanvas();

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  const cssWidth = canvas.getBoundingClientRect().width || width;
  const scale = width / cssWidth;

  ctx.clearRect(0, 0, width, height);
  ctx.lineWidth = 1.5 * scale;
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--waveform-idle').trim() || 'rgba(255,255,255,0.12)';
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(10 * scale, height / 2);
  ctx.lineTo(width - 10 * scale, height / 2);
  ctx.stroke();
}

/** Shuts down the Web Audio API context and tracks. */
function stopWaveform() {
  if (state.animFrameId) {
    cancelAnimationFrame(state.animFrameId);
    state.animFrameId = null;
  }

  state.analyserNode = null;

  if (state.mediaStream) {
    state.mediaStream.getTracks().forEach(track => track.stop());
    state.mediaStream = null;
  }

  if (state.audioContext && state.audioContext.state !== 'closed') {
    state.audioContext.close().catch(() => {});
    state.audioContext = null;
  }

  drawIdleWaveform();
}

// ==========================================================================
// 7. TRANSLATION API (MyMemory Free API)
// ==========================================================================

/** Safely decodes HTML entities returned by the translation API. */
function decodeHtmlEntities(text) {
  const textarea = document.createElement('textarea');
  // Escape '<' first so the API response can never create real markup.
  textarea.innerHTML = String(text).replace(/</g, '&lt;');
  return textarea.value;
}

/** Splits long text into sentence-friendly chunks for the free API limit. */
function splitIntoChunks(text, maxLength = TRANSLATION_CHUNK_SIZE) {
  const chunks = [];
  let remaining = text.trim();

  while (remaining.length > maxLength) {
    const windowText = remaining.slice(0, maxLength);
    let cut = -1;

    // Prefer a sentence boundary, then a word boundary.
    const sentenceMatch = windowText.match(/[.!?。！？](?=\s|$)/g);
    if (sentenceMatch) cut = windowText.lastIndexOf(sentenceMatch[sentenceMatch.length - 1]) + 1;
    if (cut < maxLength * 0.5) cut = windowText.lastIndexOf(' ') + 1;
    if (cut < maxLength * 0.5 || cut <= 0) cut = maxLength;

    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks.length ? chunks : [''];
}

/** Translates one chunk via MyMemory. */
async function translateChunk(chunk, fromCode, toCode, signal) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${encodeURIComponent(fromCode)}|${encodeURIComponent(toCode)}`;

  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Translation server returned status ${response.status}.`);

  let data;
  try {
    data = await response.json();
  } catch (_) {
    throw new Error('The translation service returned an invalid response.');
  }

  const details = String(data.responseDetails || '');
  const status = Number(data.responseStatus);

  if (status && status !== 200) {
    if (/QUERY TOO LONG/i.test(details)) {
      throw new Error('That text is too long for the free translation service. Try a shorter passage.');
    }
    if (/QUOTA|LIMIT|WARNING/i.test(details)) {
      throw new Error('The free translation quota has been reached. Please try again later.');
    }
    throw new Error(details || 'Translation failed.');
  }

  const raw = data.responseData && data.responseData.translatedText;
  if (!raw) throw new Error(details || 'Translation failed.');

  const cleaned = decodeHtmlEntities(raw).trim();
  if (/^MYMEMORY WARNING:/i.test(cleaned)) {
    throw new Error('The free translation quota has been reached. Please try again later.');
  }

  return cleaned;
}

/** Translates text, splitting long passages into multiple requests if needed. */
async function translateText(text, fromCode, toCode, signal) {
  if (!text || !text.trim()) return '';
  if (fromCode === toCode) return text.trim();

  const chunks = splitIntoChunks(text.trim());
  const translated = [];

  for (const chunk of chunks) {
    if (signal && signal.aborted) {
      const err = new Error('Aborted');
      err.name = 'AbortError';
      throw err;
    }
    translated.push(await translateChunk(chunk, fromCode, toCode, signal));
  }

  return translated.join(' ');
}

/** Cancels any pending auto-translate timer and in-flight translation request. */
function cancelPendingTranslation() {
  if (state.typingTimer) {
    clearTimeout(state.typingTimer);
    state.typingTimer = null;
  }
  state.translationRequestId++;
  if (state.translationController) {
    state.translationController.abort();
    state.translationController = null;
  }
  if (state.isTranslating) setTranslatingState(false);
}

/** Updates loading indicators during translation. */
function setTranslatingState(isTranslating) {
  state.isTranslating = isTranslating;
  elements.translatingIndicator.classList.toggle('active', isTranslating);
  refreshAppStatus();
  updateActionButtons();
}

/**
 * Translates the current source text and updates the UI.
 * @param {Object} options - Set `fromTyping` when triggered by the debounced input handler.
 */
async function translateCurrentText(options = {}) {
  const { fromTyping = false } = options;

  if (!fromTyping && state.typingTimer) {
    clearTimeout(state.typingTimer);
    state.typingTimer = null;
  }

  const text = elements.sourceText.value.trim();
  elements.translationCard.classList.remove('has-error');

  if (!text) {
    cancelPendingTranslation();
    elements.translationText.value = '';
    announce('');
    updateActionButtons();
    return;
  }

  if (!state.isOnline) {
    showToast('You are offline. Translation needs an internet connection.', true);
    return;
  }

  // Abort any previous request so only the newest result is applied.
  cancelPendingTranslation();

  const fromCode = elements.fromLangSelect.value;
  const toCode = elements.toLangSelect.value;
  const requestId = ++state.translationRequestId;
  const controller = new AbortController();
  state.translationController = controller;
  setTranslatingState(true);

  const timeoutId = setTimeout(() => controller.abort(), TRANSLATION_TIMEOUT_MS);

  try {
    const translated = await translateText(text, fromCode, toCode, controller.signal);
    if (requestId !== state.translationRequestId) return; // A newer request won.

    elements.translationText.value = translated;
    updateActionButtons();
    announce(`Translated to ${getLanguage(toCode).label}: ${translated}`);

    saveToHistory({
      sourceText: text,
      translatedText: translated,
      fromLang: fromCode,
      toLang: toCode
    });
  } catch (error) {
    if (requestId !== state.translationRequestId) return; // Superseded request.

    if (error && error.name === 'AbortError') {
      showToast('Translation timed out. Please try again.', true);
      elements.translationCard.classList.add('has-error');
      return;
    }

    console.error('Translation error:', error);
    elements.translationCard.classList.add('has-error');
    showToast(error && error.message ? error.message : 'Translation failed. Check your connection.', true);
  } finally {
    clearTimeout(timeoutId);
    if (state.translationController === controller) state.translationController = null;
    if (requestId === state.translationRequestId) setTranslatingState(false);
  }
}

// ==========================================================================
// 8. TEXT-TO-SPEECH (Browser SpeechSynthesis API)
// ==========================================================================

/** Updates the Speak button for the current speaking state. */
function updateSpeakUI() {
  elements.speakBtn.classList.toggle('speaking', state.isSpeaking);
  elements.speakBtnText.textContent = state.isSpeaking ? 'Stop' : 'Speak';
  elements.speakBtn.setAttribute('aria-label', state.isSpeaking ? 'Stop speaking' : 'Speak translation');
}

/** Reads the translated text aloud, or stops playback if already speaking. */
function speakTranslation() {
  const text = elements.translationText.value.trim();
  if (!text) {
    showToast('No translation text to speak.');
    return;
  }

  if (!('speechSynthesis' in window)) {
    showToast('Speech synthesis is not supported in this browser.', true);
    return;
  }

  if (state.isSpeaking) {
    window.speechSynthesis.cancel();
    state.isSpeaking = false;
    updateSpeakUI();
    return;
  }

  window.speechSynthesis.cancel();

  const target = getLanguage(elements.toLangSelect.value);
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = target.speechCode;

  const normalize = value => String(value || '').toLowerCase().replace(/_/g, '-');
  const exact = normalize(target.speechCode);
  const prefixes = [normalize(target.code), normalize(target.speechCode).split('-')[0]];
  const voices = window.speechSynthesis.getVoices();

  let matchedVoice = voices.find(voice => normalize(voice.lang) === exact);
  if (!matchedVoice) {
    matchedVoice = voices.find(voice => prefixes.includes(normalize(voice.lang).split('-')[0]));
  }
  if (matchedVoice) utterance.voice = matchedVoice;

  state.isSpeaking = true;
  updateSpeakUI();

  utterance.onend = () => {
    state.isSpeaking = false;
    updateSpeakUI();
  };
  utterance.onerror = (event) => {
    console.warn('Speech synthesis error:', event);
    state.isSpeaking = false;
    updateSpeakUI();
  };

  window.speechSynthesis.speak(utterance);
}

// ==========================================================================
// 9. HISTORY MANAGEMENT (localStorage)
// ==========================================================================

/** Validates and normalizes a history record loaded from storage. */
function normalizeHistoryItem(item) {
  if (!item || typeof item !== 'object') return null;
  if (typeof item.sourceText !== 'string' || typeof item.translatedText !== 'string') return null;

  return {
    id: Number(item.id) || Date.now(),
    sourceText: item.sourceText,
    translatedText: item.translatedText,
    fromLang: typeof item.fromLang === 'string' ? item.fromLang : 'en',
    toLang: typeof item.toLang === 'string' ? item.toLang : 'es',
    timestamp: typeof item.timestamp === 'string' ? item.timestamp : ''
  };
}

/** Loads the history array from localStorage. */
function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    state.history = Array.isArray(parsed)
      ? parsed.map(normalizeHistoryItem).filter(Boolean).slice(0, HISTORY_LIMIT)
      : [];
  } catch (e) {
    console.warn('Could not read history:', e);
    state.history = [];
  }
  renderHistoryList();
}

/** Persists the current history array. */
function persistHistory() {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(state.history));
  } catch (e) {
    console.warn('Failed to save history to localStorage', e);
  }
}

/** Adds a new translation to history. */
function saveToHistory(item) {
  const last = state.history[0];
  if (last && last.sourceText === item.sourceText && last.translatedText === item.translatedText) {
    return;
  }

  const record = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    sourceText: item.sourceText,
    translatedText: item.translatedText,
    fromLang: item.fromLang,
    toLang: item.toLang,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  state.history.unshift(record);
  if (state.history.length > HISTORY_LIMIT) state.history.pop();

  persistHistory();
  renderHistoryList();
}

/** Resets the two-step "Clear all" confirmation state. */
function disarmClearHistory() {
  clearTimeout(state.historyClearTimer);
  state.historyClearTimer = null;
  state.historyClearArmed = false;
  elements.clearHistoryBtn.textContent = 'Clear';
  elements.clearHistoryBtn.classList.remove('armed');
}

/** Clears all history (requires two taps). */
function clearAllHistory() {
  if (!state.historyClearArmed) {
    state.historyClearArmed = true;
    elements.clearHistoryBtn.textContent = 'Confirm?';
    elements.clearHistoryBtn.classList.add('armed');
    showToast('Tap Clear again to confirm.');
    state.historyClearTimer = setTimeout(disarmClearHistory, 4000);
    return;
  }

  disarmClearHistory();
  state.history = [];
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear history:', e);
  }
  renderHistoryList();
  showToast('History cleared.');
}

/** Removes a single history record. */
function deleteHistoryItem(id) {
  const before = state.history.length;
  state.history = state.history.filter(item => item.id !== id);
  if (state.history.length === before) return;

  persistHistory();
  renderHistoryList();
  showToast('Entry removed.');
}

/** Renders the history list into the History tab. */
function renderHistoryList() {
  const container = elements.historyList;
  if (!container) return;

  elements.historySubtitle.textContent = `Last ${HISTORY_LIMIT} translations saved locally`;

  if (state.history.length === 0) {
    container.innerHTML = `
      <div class="history-empty">
        <svg class="history-empty-icon" viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <div class="history-empty-title">No history yet</div>
        <p class="history-empty-desc">Your recent translations will appear here.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = state.history.map(item => {
    const fromName = getLanguage(item.fromLang).label;
    const toName = getLanguage(item.toLang).label;
    const sourceDir = getLanguage(item.fromLang).rtl ? 'rtl' : 'ltr';
    const targetDir = getLanguage(item.toLang).rtl ? 'rtl' : 'ltr';
    const id = escapeHtml(item.id);

    return `
      <div class="history-item" data-id="${id}" tabindex="0" role="button" aria-label="Load translation from ${escapeHtml(fromName)} to ${escapeHtml(toName)}">
        <div class="history-item-top">
          <span class="history-lang-badge">${escapeHtml(fromName)} → ${escapeHtml(toName)}</span>
          <span class="history-time">${escapeHtml(item.timestamp)}</span>
        </div>
        <div class="history-source-text" dir="${sourceDir}">${escapeHtml(item.sourceText)}</div>
        <div class="history-trans-text" dir="${targetDir}">${escapeHtml(item.translatedText)}</div>
        <div class="history-actions">
          <button class="history-action-btn load-history-btn" title="Open in Voice translator" data-id="${id}" aria-label="Load translation">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
            </svg>
          </button>
          <button class="history-action-btn copy-history-btn" title="Copy translated text" data-text="${escapeHtml(item.translatedText)}" aria-label="Copy translation">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
          <button class="history-action-btn delete-history-btn" title="Remove this entry" data-id="${id}" aria-label="Delete translation">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

/** Loads a selected history record back into the voice translator view. */
function loadHistoryItem(id) {
  const item = state.history.find(h => h.id === id);
  if (!item) return;

  cancelPendingTranslation();
  if (state.isRecording || state.finalizePending) abortRecording();

  elements.fromLangSelect.value = item.fromLang;
  elements.toLangSelect.value = item.toLang;
  updateLanguageLabels();

  elements.sourceText.value = item.sourceText;
  elements.translationText.value = item.translatedText;
  elements.translationCard.classList.remove('has-error');
  updateCharCount();
  updateActionButtons();

  switchTab('voice');
  showToast('Loaded translation into Voice view.');
  announce('Translation loaded.');
}

// ==========================================================================
// 10. NAVIGATION, SETTINGS & THEME
// ==========================================================================

/** Switches the active tab. */
function switchTab(targetTab) {
  elements.navItems.forEach(btn => {
    const isActive = btn.getAttribute('data-tab') === targetTab;
    btn.classList.toggle('active', isActive);
    if (isActive) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });

  Object.keys(elements.views).forEach(tabKey => {
    elements.views[tabKey].classList.toggle('active', tabKey === targetTab);
  });

  elements.voiceDock.hidden = targetTab !== 'voice';

  if (targetTab === 'history') {
    disarmClearHistory();
    renderHistoryList();
  }

  elements.appMain.scrollTop = 0;
}

/** Populates language dropdowns with configured languages. */
function populateLanguageDropdowns() {
  elements.fromLangSelect.innerHTML = '';
  elements.toLangSelect.innerHTML = '';

  LANGUAGES.forEach(lang => {
    const label = `${lang.label} (${lang.native})`;

    const optFrom = document.createElement('option');
    optFrom.value = lang.code;
    optFrom.textContent = label;
    elements.fromLangSelect.appendChild(optFrom);

    const optTo = document.createElement('option');
    optTo.value = lang.code;
    optTo.textContent = label;
    elements.toLangSelect.appendChild(optTo);
  });

  elements.fromLangSelect.value = 'en';
  elements.toLangSelect.value = 'es';
  elements.languageCount.textContent = String(LANGUAGES.length);
  updateLanguageLabels();
}

/** Updates card labels, text direction, and language metadata. */
function updateLanguageLabels() {
  const fromLang = getLanguage(elements.fromLangSelect.value);
  const toLang = getLanguage(elements.toLangSelect.value);

  elements.sourceLangLabel.textContent = fromLang.label;
  elements.toLangLabel.textContent = toLang.label;

  elements.sourceText.dir = fromLang.rtl ? 'rtl' : 'ltr';
  elements.sourceText.lang = fromLang.speechCode;
  elements.translationText.dir = toLang.rtl ? 'rtl' : 'ltr';
  elements.translationText.lang = toLang.speechCode;
}

/** Swaps languages and texts, then retranslates. */
function swapLanguages() {
  cancelPendingTranslation();

  const currentFrom = elements.fromLangSelect.value;
  const currentTo = elements.toLangSelect.value;
  elements.fromLangSelect.value = currentTo;
  elements.toLangSelect.value = currentFrom;
  updateLanguageLabels();

  const currentSource = elements.sourceText.value;
  const currentTranslation = elements.translationText.value;
  elements.sourceText.value = currentTranslation;
  elements.translationText.value = currentSource;
  elements.translationCard.classList.remove('has-error');

  updateCharCount();
  updateActionButtons();

  // Subtle rotation feedback
  elements.swapLangBtn.style.transform = 'rotate(180deg)';
  setTimeout(() => {
    elements.swapLangBtn.style.transform = '';
  }, 220);

  if (elements.sourceText.value.trim()) translateCurrentText();
}

/** Copies text to clipboard with button feedback. */
async function copyTextToClipboard(text, feedbackBtn = null) {
  if (!text || !text.trim()) {
    showToast('Nothing to copy.');
    return;
  }

  let copied = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      copied = true;
    }
  } catch (_) {
    copied = false;
  }

  if (!copied) {
    // Fallback for insecure contexts / older browsers
    try {
      const tempInput = document.createElement('textarea');
      tempInput.value = text;
      tempInput.setAttribute('readonly', '');
      tempInput.style.position = 'fixed';
      tempInput.style.opacity = '0';
      document.body.appendChild(tempInput);
      tempInput.select();
      copied = document.execCommand('copy');
      document.body.removeChild(tempInput);
    } catch (_) {
      copied = false;
    }
  }

  if (!copied) {
    showToast('Could not copy to clipboard.', true);
    return;
  }

  const button = feedbackBtn || elements.copyBtn;
  button.classList.add('copied');
  const label = button.querySelector('.copy-label');
  if (label) label.textContent = 'Copied!';
  showToast('Copied to clipboard!');

  setTimeout(() => {
    button.classList.remove('copied');
    if (label) label.textContent = 'Copy';
  }, 1800);
}

/** Populates language settings view with presets and reference guide. */
function renderLanguageSettings() {
  elements.presetPairsList.innerHTML = PRESET_PAIRS.map(pair => `
    <button class="preset-btn" data-from="${escapeHtml(pair.from)}" data-to="${escapeHtml(pair.to)}">
      ${escapeHtml(pair.label)}
    </button>
  `).join('');

  elements.languageGuideList.innerHTML = LANGUAGES.map(lang => `
    <li class="language-guide-item">
      <span class="language-guide-name">${escapeHtml(lang.label)} (${escapeHtml(lang.native)})</span>
      <span class="language-guide-meta">${escapeHtml(lang.speechCode)}</span>
    </li>
  `).join('');
}

/** Applies the selected theme and updates the theme buttons. */
function applyTheme(theme) {
  const valid = ['dark', 'light', 'system'].includes(theme) ? theme : 'dark';
  state.theme = valid;

  const resolved = valid === 'system'
    ? (state.systemThemeMedia && state.systemThemeMedia.matches ? 'dark' : 'light')
    : valid;

  document.documentElement.dataset.theme = resolved;

  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) themeColorMeta.content = resolved === 'dark' ? '#0f0f12' : '#f5f6f8';

  elements.themeOptions.querySelectorAll('.theme-btn').forEach(btn => {
    btn.setAttribute('aria-pressed', String(btn.dataset.theme === valid));
  });

  try {
    localStorage.setItem(THEME_STORAGE_KEY, valid);
  } catch (_) {
    // Theme still applies for this session.
  }

  drawIdleWaveform();
}

/** Loads the saved theme preference. */
function loadTheme() {
  let saved = 'dark';
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw && ['dark', 'light', 'system'].includes(raw)) saved = raw;
  } catch (_) {
    // Ignore storage errors.
  }
  applyTheme(saved);
}

/** Handles online/offline transitions. */
function handleConnectionChange() {
  state.isOnline = navigator.onLine !== false;
  refreshAppStatus();
  showToast(state.isOnline ? 'Back online. Translation is available.' : 'You are offline. The app shell still works.', !state.isOnline);
}

// ==========================================================================
// 11. EVENT LISTENERS & INITIALIZATION
// ==========================================================================

function handleHistoryClick(event) {
  const deleteBtn = event.target.closest('.delete-history-btn');
  if (deleteBtn) {
    event.stopPropagation();
    deleteHistoryItem(Number(deleteBtn.dataset.id));
    return;
  }

  const copyBtn = event.target.closest('.copy-history-btn');
  if (copyBtn) {
    event.stopPropagation();
    copyTextToClipboard(copyBtn.dataset.text || '', copyBtn);
    return;
  }

  const loadBtn = event.target.closest('.load-history-btn');
  if (loadBtn) {
    event.stopPropagation();
    loadHistoryItem(Number(loadBtn.dataset.id));
    return;
  }

  const card = event.target.closest('.history-item');
  if (card) loadHistoryItem(Number(card.dataset.id));
}

function handleHistoryKeydown(event) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const card = event.target.closest('.history-item');
  if (!card || event.target !== card) return;
  event.preventDefault();
  loadHistoryItem(Number(card.dataset.id));
}

function initEventListeners() {
  // Tab navigation
  elements.navItems.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
  });

  // Mic button: start / stop
  elements.micBtn.addEventListener('click', () => {
    if (state.isRecording) stopRecording();
    else startRecording();
  });

  // Translation triggers
  elements.translateBtn.addEventListener('click', () => translateCurrentText());
  elements.retryBtn.addEventListener('click', () => translateCurrentText());

  // Auto-translate typed text after a short pause
  elements.sourceText.addEventListener('input', () => {
    updateCharCount();
    updateActionButtons();
    clearTimeout(state.typingTimer);
    state.typingTimer = null;

    const text = elements.sourceText.value.trim();
    if (text.length < 2) {
      elements.translationText.value = '';
      elements.translationCard.classList.remove('has-error');
      updateActionButtons();
      return;
    }

    state.typingTimer = setTimeout(() => {
      state.typingTimer = null;
      translateCurrentText({ fromTyping: true });
    }, AUTO_TRANSLATE_DELAY_MS);
  });

  // Enter translates immediately; Shift+Enter inserts a newline
  elements.sourceText.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      translateCurrentText();
    }
  });

  // Language selectors
  elements.fromLangSelect.addEventListener('change', () => {
    updateLanguageLabels();
    if (elements.sourceText.value.trim()) translateCurrentText();
  });
  elements.toLangSelect.addEventListener('change', () => {
    updateLanguageLabels();
    if (elements.sourceText.value.trim()) translateCurrentText();
  });
  elements.swapLangBtn.addEventListener('click', swapLanguages);

  // Clear source text
  elements.clearSourceBtn.addEventListener('click', () => {
    cancelPendingTranslation();
    elements.sourceText.value = '';
    elements.translationText.value = '';
    elements.translationCard.classList.remove('has-error');
    updateCharCount();
    updateActionButtons();
    elements.sourceText.focus();
  });

  // Copy / Speak
  elements.copyBtn.addEventListener('click', () => copyTextToClipboard(elements.translationText.value));
  elements.speakBtn.addEventListener('click', speakTranslation);

  // History (event delegation)
  elements.historyList.addEventListener('click', handleHistoryClick);
  elements.historyList.addEventListener('keydown', handleHistoryKeydown);
  elements.clearHistoryBtn.addEventListener('click', clearAllHistory);

  // Preset pairs
  elements.presetPairsList.addEventListener('click', (event) => {
    const btn = event.target.closest('.preset-btn');
    if (!btn) return;
    elements.fromLangSelect.value = btn.dataset.from;
    elements.toLangSelect.value = btn.dataset.to;
    updateLanguageLabels();
    switchTab('voice');
    showToast(`Set to ${btn.textContent.trim()}`);
    if (elements.sourceText.value.trim()) translateCurrentText();
  });

  // Theme buttons
  elements.themeOptions.addEventListener('click', (event) => {
    const btn = event.target.closest('.theme-btn');
    if (btn) applyTheme(btn.dataset.theme);
  });
  if (state.systemThemeMedia) {
    const onSystemChange = () => {
      if (state.theme === 'system') applyTheme('system');
    };
    if (state.systemThemeMedia.addEventListener) state.systemThemeMedia.addEventListener('change', onSystemChange);
    else if (state.systemThemeMedia.addListener) state.systemThemeMedia.addListener(onSystemChange);
  }

  // Diagnostics
  if (elements.diagRefreshBtn) {
    elements.diagRefreshBtn.addEventListener('click', () => {
      queryMicPermission().then(renderDiagnostics);
    });
  }
  if (elements.diagCopyBtn) {
    elements.diagCopyBtn.addEventListener('click', () => {
      copyTextToClipboard(elements.diagOutput.textContent, elements.diagCopyBtn);
    });
  }

  // Connectivity
  window.addEventListener('online', handleConnectionChange);
  window.addEventListener('offline', handleConnectionChange);

  // Stop recording when the page is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.isRecording) stopRecording();
  });

  // Keep the canvas crisp on rotation/resize
  window.addEventListener('resize', () => {
    if (!state.isRecording) drawIdleWaveform();
  });

  // Load voices as soon as they are available
  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }
}

/** App initialization entry point. */
function initApp() {
  populateLanguageDropdowns();
  renderLanguageSettings();
  loadTheme();
  loadHistory();
  initSpeechRecognition();
  initEventListeners();
  queryMicPermission();
  logDiag('App initialized');

  updateCharCount();
  updateActionButtons();
  updateSpeakUI();
  drawIdleWaveform();
  refreshAppStatus();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// ==========================================================================
// 12. SERVICE WORKER REGISTRATION (PWA)
// ==========================================================================

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        console.log('Voice Translator Service Worker registered:', reg.scope);
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      })
      .catch(err => {
        console.warn('Service Worker registration failed:', err);
      });
  });
}
