import { fetchSTT } from "@/lib";
import { UseCompletionReturn } from "@/types";
import { useMicVAD } from "@ricky0123/vad-react";
import { LoaderCircleIcon, MicIcon, MicOffIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components";
import { useApp } from "@/contexts";
import { floatArrayToWav } from "@/lib/utils";
import { shouldUsePluelyAPI } from "@/lib/functions/pluely.api";
import {
  getSpeechMergeDelay,
  isActionableSpeech,
  mergeSpeechSegments,
} from "@/lib/speech-utterance";

interface AutoSpeechVADProps {
  submit: UseCompletionReturn["submit"];
  setState: UseCompletionReturn["setState"];
  setEnableVAD: UseCompletionReturn["setEnableVAD"];
  microphoneDeviceId?: string;
}

const AutoSpeechVADInternal = ({
  submit,
  setState,
  setEnableVAD,
  microphoneDeviceId,
}: AutoSpeechVADProps) => {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const { selectedSttProvider, allSttProviders } = useApp();
  const pendingTranscriptionRef = useRef("");
  const submitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitRef = useRef(submit);
  const activeTranscriptionsRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);

  const flushPendingTranscription = useCallback(() => {
    if (submitTimerRef.current) {
      clearTimeout(submitTimerRef.current);
      submitTimerRef.current = null;
    }

    const transcription = pendingTranscriptionRef.current;
    pendingTranscriptionRef.current = "";
    if (isActionableSpeech(transcription)) {
      submitRef.current(transcription);
    }
  }, []);

  const schedulePendingTranscription = useCallback(() => {
    if (
      activeTranscriptionsRef.current > 0 ||
      !pendingTranscriptionRef.current
    ) {
      return;
    }

    if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
    submitTimerRef.current = setTimeout(
      flushPendingTranscription,
      getSpeechMergeDelay(pendingTranscriptionRef.current)
    );
  }, [flushPendingTranscription]);

  const queueTranscription = useCallback(
    (transcription: string) => {
      if (!isActionableSpeech(transcription)) return;

      pendingTranscriptionRef.current = mergeSpeechSegments(
        pendingTranscriptionRef.current,
        transcription
      );
      schedulePendingTranscription();
    },
    [schedulePendingTranscription]
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
    };
  }, []);

  const audioConstraints: MediaTrackConstraints =
    microphoneDeviceId && microphoneDeviceId !== "default"
      ? { deviceId: { exact: microphoneDeviceId } }
      : {};

  const vad = useMicVAD({
    userSpeakingThreshold: 0.6,
    startOnLoad: true,
    additionalAudioConstraints: audioConstraints,
    onSpeechEnd: async (audio) => {
      activeTranscriptionsRef.current += 1;
      if (submitTimerRef.current) {
        clearTimeout(submitTimerRef.current);
        submitTimerRef.current = null;
      }

      try {
        // convert float32array to blob
        const audioBlob = floatArrayToWav(audio, 16000, "wav");

        let transcription: string;
        const usePluelyAPI = await shouldUsePluelyAPI();

        // Check if we have a configured speech provider
        if (!selectedSttProvider.provider && !usePluelyAPI) {
          console.warn("No speech provider selected");
          setState((prev: any) => ({
            ...prev,
            error:
              "No speech provider selected. Please select one in settings.",
          }));
          return;
        }

        const providerConfig = allSttProviders.find(
          (p) => p.id === selectedSttProvider.provider
        );

        if (!providerConfig && !usePluelyAPI) {
          console.warn("Selected speech provider configuration not found");
          setState((prev: any) => ({
            ...prev,
            error:
              "Speech provider configuration not found. Please check your settings.",
          }));
          return;
        }

        setIsTranscribing(true);

        // Use the fetchSTT function for all providers
        transcription = await fetchSTT({
          provider: usePluelyAPI ? undefined : providerConfig,
          selectedProvider: selectedSttProvider,
          audio: audioBlob,
        });

        if (isMountedRef.current) queueTranscription(transcription);
      } catch (error) {
        console.error("Failed to transcribe audio:", error);
        setState((prev: any) => ({
          ...prev,
          error:
            error instanceof Error ? error.message : "Transcription failed",
        }));
      } finally {
        activeTranscriptionsRef.current = Math.max(
          0,
          activeTranscriptionsRef.current - 1
        );
        if (isMountedRef.current) {
          setIsTranscribing(false);
          schedulePendingTranscription();
        }
      }
    },
  });

  return (
    <>
      <Button
        size="icon"
        onClick={() => {
          if (vad.listening) {
            vad.pause();
            flushPendingTranscription();
            setEnableVAD(false);
          } else {
            vad.start();
            setEnableVAD(true);
          }
        }}
        className="cursor-pointer"
      >
        {isTranscribing ? (
          <LoaderCircleIcon className="h-4 w-4 animate-spin text-green-500" />
        ) : vad.userSpeaking ? (
          <LoaderCircleIcon className="h-4 w-4 animate-spin" />
        ) : vad.listening ? (
          <MicOffIcon className="h-4 w-4 animate-pulse" />
        ) : (
          <MicIcon className="h-4 w-4" />
        )}
      </Button>
    </>
  );
};

export const AutoSpeechVAD = (props: AutoSpeechVADProps) => {
  return <AutoSpeechVADInternal key={props.microphoneDeviceId} {...props} />;
};
