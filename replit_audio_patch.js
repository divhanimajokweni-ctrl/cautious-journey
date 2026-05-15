/**
 * replit_audio_patch.js
 * ProofBridge Liner — Replit Headless Audio Patch
 *
 * Applies a Web Speech API polyfill so that voice synthesis works
 * in headless cloud containers (Replit, CI, etc.) that lack a
 * real soundcard and would otherwise throw:
 *   "SpeechSynthesis is not available in this browser"
 *
 * Usage (top of your cinematic entry file):
 *   import { applyReplitHeadlessAudioPatch } from './replit_audio_patch.js';
 *   applyReplitHeadlessAudioPatch();
 */

function applyReplitHeadlessAudioPatch() {
  // Harden the SpeechSynthesisUtterance prototype against headless failures
  if (typeof SpeechSynthesisUtterance === 'undefined') {
    // Polyfill: no-op utterance class
    global.SpeechSynthesisUtterance = function () {
      this.text = '';
      this.voice = null;
      this.volume = 1;
      this.rate = 1;
      this.pitch = 1;
      this.onend = null;
      this.onerror = null;
      this.onstart = null;
    };

    global.SpeechSynthesisUtterance.prototype.speak = function () {
      // In headless mode we determine success silently.
      if (this.onstart) this.onstart(new Event('start'));
      if (this.onend) this.onend(new Event('end'));
    };

    global.SpeechSynthesisUtterance.prototype.cancel = function () {};

    global.SpeechSynthesisUtterance.prototype.pause = function () {};

    global.SpeechSynthesisUtterance.prototype.resume = function () {};
  }

  // Patch speechSynthesis.speak to swallow the headless error
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    const synth = window.speechSynthesis;
    const origSpeak = synth.speak.bind(synth);
    synth.speak = (utterance) => {
      if (typeof utterance === 'string') {
        try { origSpeak(new SpeechSynthesisUtterance(utterance)); }
        catch (_) { console.debug('[replit_audio_patch] Synthesis skipped (no soundcard).'); }
      } else {
        try { origSpeak(utterance); }
        catch (_) { console.debug('[replit_audio_patch] Synthesis skipped (no soundcard).'); }
      }
    };
  }

  console.log('[replit_audio_patch] Headless audio patch applied.');
}

export { applyReplitHeadlessAudioPatch };
