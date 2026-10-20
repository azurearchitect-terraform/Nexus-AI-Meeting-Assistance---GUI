# Changelog

All notable changes to Nexus AI Meeting Assistance are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.4.0] - 2026-10-20

### Added
- **Real-Time Soundwave Visualizer (`ListeningWaveVisualizer`)**:
  - Added an interactive 16-bar animated audio equalizer in the Listen Mode bottom dock.
  - Automatically transitions between idle listening (gentle rhythmic breathing wave) and active voice detection (high-amplitude dancing bars with vivid emerald glow).
- **Live Voice Activity & Listening Indicators**:
  - Added dynamic soundwave indicators (`MiniSoundWave`) in the top `OverlayTabBar`, mode buttons, and the Live Question ticker.
  - Question bar instantly displays `🎙️ Capturing voice in real time...` with a live pulsing ping indicator as soon as speech is detected, completely eliminating uncertainty about whether audio is being captured.
- **Backend Real-Time Audio Signaling**:
  - Implemented real-time Rust VAD events (`speech-start`, `speech-end`, and throttled ~85ms `audio-level` metrics) to drive the visualizer with native 60fps performance and zero UI latency.

### Optimized
- **Instant Response Streaming (Zero Typewriter Delay)**:
  - Eliminated the artificial 15ms character-by-character typewriter buffering in `StreamingTextView`.
  - Responses now render immediately on screen with a blinking cursor from the very first token chunk received from the LLM.
- **Ultra-Low Meeting Transcription Latency**:
  - Decreased VAD silence threshold from 2.88s (45 chunks) to 1.28s (20 chunks), saving ~1.6s of dead air wait per utterance.
  - Reduced post-speech JS merge debounce delay from 2300ms down to 250ms (and 200ms for questions ending in `?` or `.`).
  - Added immediate UI transcription update so text displays the instant speech-to-text finishes.
  - Reduced stream chunk polling from 50ms to 16ms (60 FPS).

---

## [2.3.1] - 2026-10-16

### Changed
- Speech transcription latency optimizations across frontend and backend.
- Preserved meeting sessions and answer reuse caching.
- Enhanced company intelligence and interview hint mode.

---

## [2.3.0] - 2026-09-09

### Added
- Upgraded meeting audio pipelines and multi-provider AI routing.
- Context-aware answer reuse with 80% similarity threshold.
- Enhanced local privacy protections and offline storage.
