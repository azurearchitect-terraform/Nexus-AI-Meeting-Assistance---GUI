import { describe, expect, it } from "vitest";
import {
  calculateQuestionSimilarity,
  findCachedAnswer,
} from "./question-answer-cache";

describe("calculateQuestionSimilarity", () => {
  it("treats a lightly reworded repeated question as at least 80% similar", () => {
    const original =
      "How would you design a CI/CD pipeline using Azure DevOps to deploy containers to Azure Kubernetes Service?";
    const repeated =
      "How would you design the CI/CD pipeline with Azure DevOps to deploy those containers to Azure Kubernetes Service?";

    expect(calculateQuestionSimilarity(original, repeated)).toBeGreaterThanOrEqual(
      0.8
    );
  });

  it("ignores filler words and punctuation", () => {
    expect(
      calculateQuestionSimilarity(
        "How would you monitor containers in AKS?",
        "How, uh, would you monitor containers in AKS?"
      )
    ).toBe(1);
  });

  it("does not confuse different questions", () => {
    expect(
      calculateQuestionSimilarity(
        "How would you deploy containers to AKS?",
        "How would you diagnose a memory leak in Java?"
      )
    ).toBeLessThan(0.8);
  });
});

describe("findCachedAnswer", () => {
  const messages = [
    {
      id: "user-1",
      role: "user" as const,
      content: "How would you design a CI/CD pipeline for AKS?",
      timestamp: 1,
    },
    {
      id: "assistant-1",
      role: "assistant" as const,
      content: "Use Azure Pipelines to build, scan, push, and deploy.",
      timestamp: 2,
    },
  ];

  it("returns the prior answer for an 80%-similar question", () => {
    expect(
      findCachedAnswer(
        "How would you design the CI/CD pipeline for AKS?",
        messages
      )
    ).toMatchObject({
      answer: "Use Azure Pipelines to build, scan, push, and deploy.",
    });
  });

  it("returns no answer below the threshold", () => {
    expect(
      findCachedAnswer("Explain Java garbage collection.", messages)
    ).toBeNull();
  });

  it("supports newest-first UI messages by sorting timestamps", () => {
    expect(
      findCachedAnswer(
        "How would you design a CI/CD pipeline for AKS?",
        [...messages].reverse()
      )
    ).not.toBeNull();
  });
});
