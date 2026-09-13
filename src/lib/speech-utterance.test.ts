import { describe, expect, it } from "vitest";
import {
  areSpeechSegmentsEquivalent,
  getSpeechMergeDelay,
  INCOMPLETE_SPEECH_MERGE_DELAY_MS,
  isActionableSpeech,
  mergeSpeechSegments,
  SPEECH_MERGE_DELAY_MS,
} from "./speech-utterance";

describe("isActionableSpeech", () => {
  it.each([
    "cool",
    "OK.",
    "yeah",
    "also",
    "hello",
    "thank you",
    "[Cough]",
    "(coughing)",
    "[Background noise]",
    "uh um",
    "No transcription found",
  ])("rejects non-actionable transcription %s", (transcription) => {
    expect(isActionableSpeech(transcription)).toBe(false);
  });

  it.each([
    "Why?",
    "How would you design this system?",
    "Cool features are useful, but how would you implement one?",
    "Tell me about a difficult production incident",
  ])("keeps meaningful transcription %s", (transcription) => {
    expect(isActionableSpeech(transcription)).toBe(true);
  });
});

describe("mergeSpeechSegments", () => {
  it("joins separate parts of a scenario question", () => {
    const scenario = mergeSpeechSegments(
      "Imagine that a service is receiving ten thousand requests per second",
      "and the database starts timing out. How would you diagnose and fix it?"
    );

    expect(scenario).toBe(
      "Imagine that a service is receiving ten thousand requests per second and the database starts timing out. How would you diagnose and fix it?"
    );
  });

  it("removes repeated overlap between adjacent STT segments", () => {
    expect(
      mergeSpeechSegments(
        "Tell me how you handled a production incident",
        "a production incident involving data loss."
      )
    ).toBe("Tell me how you handled a production incident involving data loss.");
  });

  it("does not duplicate a repeated segment", () => {
    expect(mergeSpeechSegments("What is dependency injection?", "What is dependency injection?")).toBe(
      "What is dependency injection?"
    );
  });

  it("deduplicates repeated STT results with punctuation and filler differences", () => {
    const original =
      "A development team is adopting a microservices architecture, and each microservice is deployed as a container. How would you design a CI/CD pipeline using Azure DevOps to automate the deployment of these containers to Azure Kubernetes Services, AKS?";
    const duplicate =
      "A development team is adopting a microservices architecture and each microservice is deployed as a container. How would you design a CI/CD pipeline using Azure DevOps to automate the uh deployment of these containers to Azure Kubernetes Services, AKS?";

    expect(mergeSpeechSegments(original, duplicate)).toBe(original);
  });

  it("collapses repeated questions returned in one STT result", () => {
    const original =
      "A development team is adopting a microservices architecture, and each microservice is deployed as a container. How would you design a CI/CD pipeline using Azure DevOps to automate the deployment of these containers to Azure Kubernetes Services, AKS?";
    const repeated = `${original} A development team is adopting a microservices architecture and each microservice is deployed as a container. How would you design a CI/CD pipeline using Azure DevOps to automate the uh deployment of these containers to Azure Kubernetes Services, AKS? ${original}`;

    expect(mergeSpeechSegments("", repeated)).toBe(original);
  });
});

describe("areSpeechSegmentsEquivalent", () => {
  it("matches near-duplicate transcriptions", () => {
    expect(
      areSpeechSegmentsEquivalent(
        "How would you automate deployment of these containers to AKS?",
        "How would you automate the uh deployment of these containers to AKS?"
      )
    ).toBe(true);
  });

  it("does not merge different follow-up questions", () => {
    expect(
      areSpeechSegmentsEquivalent(
        "How would you deploy these containers to AKS?",
        "How would you monitor those containers after deployment?"
      )
    ).toBe(false);
  });
});

describe("getSpeechMergeDelay", () => {
  it("allows more time for an unfinished question fragment", () => {
    expect(getSpeechMergeDelay("How would you design a")).toBe(
      INCOMPLETE_SPEECH_MERGE_DELAY_MS
    );
  });

  it("uses the normal delay for a complete question", () => {
    expect(getSpeechMergeDelay("How would you design it?")).toBe(
      SPEECH_MERGE_DELAY_MS
    );
  });

  it("keeps a scenario introduction open for the actual question", () => {
    expect(
      getSpeechMergeDelay(
        "Imagine that your primary database becomes unavailable."
      )
    ).toBe(INCOMPLETE_SPEECH_MERGE_DELAY_MS);
  });
});
