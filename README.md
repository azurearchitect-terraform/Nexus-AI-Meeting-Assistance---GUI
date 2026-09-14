# Nexus AI Meeting Assistance

Nexus AI Meeting Assistance is a cross-platform desktop assistant for meetings,
technical interviews, live conversations, and focused AI support. It combines
system-audio capture, speech-to-text, configurable AI providers, local
conversation history, interview preparation, and cost-aware answer reuse in a
lightweight Tauri application.

The application is built with React, TypeScript, Rust, Tauri, SQLite, and Vite.

## Current capabilities

### Intelligent live listening

- Capture system output audio or a selected microphone.
- Use voice activity detection (VAD) to identify complete speech segments.
- Support continuous recording when automatic VAD is disabled.
- Preserve the active transcript and answers when System Audio is paused,
  stopped, disabled, or enabled again.
- Keep uninterrupted utterances for up to 90 seconds, allowing long technical
  and scenario-based questions to remain intact.
- Buffer nearby speech segments and merge them into one complete question.
- Preserve STT result order when transcription requests finish concurrently.
- Remove repeated overlap between adjacent speech segments.
- Suppress near-duplicate transcriptions even when punctuation or filler words
  differ.
- Ignore acknowledgements and non-actionable sounds such as `ok`, `cool`,
  filler speech, coughing, breathing, background noise, and silence labels.
- Display live transcription, streaming answers, recording state, and audio
  activity.

### Cost-aware answer reuse

- Save meeting conversations locally.
- Compare each new question with previous questions using an explicit
  similarity threshold of 80%.
- Return the previous answer immediately when a sufficiently similar question
  is found.
- Skip the AI response API call when a saved answer is reused.
- Search both the current session and persisted conversation history.
- Mark reused responses with a `Cached` indicator.
- Keep saved history when the recycle-bin button clears the visible screen.
- Refuse to clear the screen if the current conversation cannot be saved.

Answer reuse avoids the LLM response request. A configured cloud
speech-to-text provider may still charge for transcription. Local providers can
be used to reduce or eliminate provider costs.

### Ask mode and multimodal assistance

- Ask typed questions and receive streamed Markdown responses.
- Dictate questions through voice input.
- Capture a full screenshot or selected screen region.
- Attach screenshots and image files to supported vision models.
- Render formatted Markdown, code blocks, tables, mathematics, and copyable
  responses.
- Maintain conversational context and local chat history.
- Start new conversations and review previous chats from the dashboard.

### AI provider support

Nexus supports built-in configurations for:

- Intelligent automatic provider routing
- OpenAI
- Anthropic Claude
- Google Gemini
- xAI Grok
- Groq
- Mistral AI
- Cohere
- Perplexity
- OpenRouter
- Ollama for local inference

The developer configuration area also supports custom provider definitions,
custom models, streaming response paths, request variables, and curl-based API
templates.

### Speech-to-text providers

Built-in STT configurations include:

- Gemini Speech-to-Text
- OpenAI Whisper
- Groq Whisper
- ElevenLabs
- Google Speech-to-Text
- Deepgram
- Azure Speech-to-Text
- Speechmatics
- Rev AI
- IBM Watson Speech-to-Text

Custom STT providers can be configured with endpoint, authentication, audio
format, request fields, headers, model, and response content path.

### Interview preparation

- Select interview modes for behavioral, technical, system-design, HR,
  recruiter, leadership, or mixed interviews.
- Build a reusable STAR story bank with situation, task, action, result,
  metrics, tags, and role focus.
- Search and organize saved interview stories.
- Match relevant experience to interview questions.
- Score practice answers and retain interview debriefs.
- Prepare company intelligence and candidate questions.
- Use configurable expert personas and prompt templates during live sessions.
- Search locally indexed resume content for self-introduction and
  background-related questions.
- Keep general technical questions separate from resume context.

### Meeting workflow

- Generate structured meeting summaries from the captured conversation.
- Track questions and responses in the current meeting.
- Add transcript bookmarks through a global shortcut.
- Copy the latest answer.
- Choose response language and response length.
- Configure custom system prompts and personas.
- Use quick actions for common meeting tasks.
- Adjust text size, text color, transparency, and focus mode.
- Pause, resume, stop, and restart audio without losing the visible meeting.

### Desktop experience

- Always-on-top overlay.
- Compact and focus-oriented display modes.
- Configurable transparency.
- Optional application icon visibility.
- Automatic startup support.
- Global keyboard shortcuts.
- Screenshot configuration.
- Audio input and output device selection.
- Update support for packaged desktop releases.
- Windows, macOS, and Linux Tauri targets.

### Default keyboard shortcuts

| Action | Windows/Linux | macOS |
| --- | --- | --- |
| Toggle dashboard | `Ctrl+Shift+D` | `Cmd+Shift+D` |
| Show or hide window | `Ctrl+\` | `Cmd+\` |
| Focus input | `Ctrl+Shift+I` | `Cmd+Shift+I` |
| Toggle system audio | `Ctrl+Shift+M` | `Cmd+Shift+M` |
| Start voice input | `Ctrl+Shift+A` | `Cmd+Shift+A` |
| Capture screenshot | `Ctrl+Shift+S` | `Cmd+Shift+S` |
| Panic action | `Ctrl+Shift+X` | `Cmd+Shift+X` |
| Add transcript bookmark | `Ctrl+Shift+B` | `Cmd+Shift+B` |

Shortcuts can be changed from the application settings.

## Privacy and data

- Conversations and messages are stored in a local SQLite database.
- Story-bank and interview-preparation data remain on the local device.
- Provider configuration and keys use local application storage and supported
  secure-storage integrations.
- The application supports bring-your-own-provider credentials.
- Ollama can be used for local model inference.
- The recycle-bin action clears the current screen without deleting saved
  conversation history.
- Permanent history deletion remains a separate dashboard/settings operation.

When a cloud AI or STT provider is selected, the content required for that
request is sent to that provider and is subject to its terms and pricing.

## Architecture

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Desktop shell | Tauri 2 and Rust | Windows, capture, shortcuts, audio, packaging |
| User interface | React 19 and TypeScript | Overlay, dashboard, settings, chats |
| Styling | Tailwind CSS and Radix UI | Responsive application components |
| AI integration | Provider adapters and curl templates | Streaming text and vision requests |
| Speech | Native audio capture, VAD, STT adapters | Segmentation and transcription |
| Storage | SQLite and local storage | Chats, prompts, settings, memory |
| Retrieval | Local document indexing and RAG | Resume and knowledge lookup |
| Validation | TypeScript, Vitest, Cargo | Frontend and native correctness |

## Prerequisites

Install the following before development:

- Node.js 20 or newer
- pnpm
- Rust and Cargo
- Tauri 2 operating-system prerequisites
- WebView2 on supported Windows systems
- WebKitGTK development packages on Linux
- Xcode command-line tools on macOS

See the official Tauri prerequisites for platform-specific native packages:
<https://v2.tauri.app/start/prerequisites/>

## Installation

Clone the repository and use the `main` branch:

```powershell
git clone https://github.com/azurearchitect-terraform/Nexus-AI-Meeting-Assistance---GUI.git
Set-Location "Nexus-AI-Meeting-Assistance---GUI"
git switch main
pnpm install --frozen-lockfile
```

## Development

Run the desktop application:

```powershell
pnpm tauri dev
```

Run only the frontend:

```powershell
pnpm dev
```

## Configuration

Before using live assistance:

1. Open the dashboard.
2. Configure an AI provider and model, or select a local Ollama model.
3. Configure a speech-to-text provider.
4. Select the correct system output or microphone device.
5. Choose a persona, prompt, response language, and response length.
6. Start System Audio from the overlay.

Provider API costs are controlled by the selected provider. Cached-answer reuse
reduces repeat LLM requests, while local models provide the strongest option
for cost control.

## Quality checks

Run all unit tests:

```powershell
pnpm exec vitest run
```

Run TypeScript validation:

```powershell
pnpm exec tsc --noEmit
```

Build the frontend:

```powershell
pnpm build
```

Check the Rust application:

```powershell
cargo check --manifest-path src-tauri\Cargo.toml
```

## Production build

Build the native desktop packages:

```powershell
pnpm tauri build
```

Generated installers are placed under:

```text
src-tauri\target\release\bundle
```

## Project structure

```text
src/
  components/       Shared UI and Markdown rendering
  config/           Providers, shortcuts, prompts, and constants
  contexts/         Application and theme state
  hooks/            Chat, audio, completion, and settings workflows
  lib/              AI, STT, storage, RAG, caching, and interview logic
  pages/            Overlay and dashboard pages
src-tauri/
  src/              Native Rust commands and platform integrations
  capabilities/     Tauri permission configuration
```

## Contributing

1. Create a focused branch from `main`.
2. Keep changes limited to one feature or fix.
3. Add tests for behavior changes.
4. Run the TypeScript checks, tests, frontend build, and relevant Rust checks.
5. Open a pull request with the motivation, implementation details, and test
   evidence.

## Security

Do not commit provider keys, tokens, credentials, meeting transcripts, resumes,
or generated local databases. Report security concerns according to
[`SECURITY.md`](SECURITY.md).

## License

This repository is licensed under the GNU General Public License v3.0. See
[`LICENSE`](LICENSE) for the complete terms.
