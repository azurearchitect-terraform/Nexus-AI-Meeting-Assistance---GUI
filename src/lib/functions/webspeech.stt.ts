/**
 * Dual Audio Processing Pipeline - WebSpeech API Fallback
 * Provides zero-latency, zero-cost local Speech-to-Text transcription.
 */

export interface WebSpeechResult {
  transcript: string;
  isFinal: boolean;
}

export class WebSpeechRecognizer {
  private recognition: any = null;
  public isListening: boolean = false;
  private onResultCallback?: (result: WebSpeechResult) => void;
  private onErrorCallback?: (error: string) => void;

  constructor() {
    const SpeechRecognition =
      typeof window !== "undefined"
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : undefined;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = "en-US";

      this.recognition.onresult = (event: any) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const transcript = finalTranscript || interimTranscript;
        if (this.onResultCallback && transcript) {
          this.onResultCallback({
            transcript,
            isFinal: !!finalTranscript,
          });
        }
      };

      this.recognition.onerror = (event: any) => {
        if (this.onErrorCallback) {
          this.onErrorCallback(event.error || "WebSpeech error");
        }
      };
    }
  }

  public isSupported(): boolean {
    return !!this.recognition;
  }

  public start(
    onResult: (result: WebSpeechResult) => void,
    onError?: (error: string) => void
  ) {
    if (!this.recognition || this.isListening) return;
    this.onResultCallback = onResult;
    this.onErrorCallback = onError;
    try {
      this.recognition.start();
      this.isListening = true;
    } catch (e) {
      console.error("Failed to start WebSpeech recognition:", e);
    }
  }

  public stop() {
    if (!this.recognition || !this.isListening) return;
    try {
      this.recognition.stop();
    } catch (e) {
      console.error("Failed to stop WebSpeech recognition:", e);
    } finally {
      this.isListening = false;
    }
  }
}

export const webSpeechRecognizer = new WebSpeechRecognizer();
