// High-performance Hybrid Real-Time Interview Copilot Backend module for Tauri v2
use anyhow::{anyhow, Result};
use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::{Arc, RwLock};
use tauri::{AppHandle, Emitter, State};

/// 1. In-Memory State Management (Zero-Latency Context)
/// Stores Resume, Job Description (JD), and active transcript in RAM.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CopilotRAMContext {
    pub resume_text: String,
    pub job_description_text: String,
    pub active_transcript: String,
    pub system_prompt_template: String,
    pub silence_threshold_ms: u64, // Enforced to 800ms
}

#[derive(Default)]
pub struct CopilotState {
    pub ram_context: Arc<RwLock<CopilotRAMContext>>,
    pub is_streaming_openai: Arc<RwLock<bool>>,
    pub gemini_ws_active: Arc<RwLock<bool>>,
}

/// Tauri Command: Set Copilot Context in RAM instantly (Zero SQLite latency)
#[tauri::command]
pub async fn set_copilot_ram_context(
    state: State<'_, CopilotState>,
    resume: String,
    job_description: String,
) -> Result<String, String> {
    let mut lock = state
        .ram_context
        .write()
        .map_err(|e| format!("Lock acquisition failed: {}", e))?;

    lock.resume_text = resume;
    lock.job_description_text = job_description;
    lock.silence_threshold_ms = 800; // Enforce 800ms VAD silence trigger rule

    Ok("Copilot RAM context updated successfully with zero SQLite latency.".to_string())
}

/// Tauri Command: Get Copilot Context from RAM
#[tauri::command]
pub async fn get_copilot_ram_context(
    state: State<'_, CopilotState>,
) -> Result<CopilotRAMContext, String> {
    let lock = state
        .ram_context
        .read()
        .map_err(|e| format!("Lock acquisition failed: {}", e))?;

    Ok(lock.clone())
}

/// Tauri Command: Process live transcript and check VAD 800ms silence trigger
#[tauri::command]
pub async fn process_audio_vad_chunk(
    app: AppHandle,
    state: State<'_, CopilotState>,
    transcript_chunk: String,
    openai_api_key: String,
    is_silence_800ms: bool,
) -> Result<(), String> {
    let (resume, jd, full_transcript) = {
        let mut lock = state
            .ram_context
            .write()
            .map_err(|e| format!("Lock acquisition failed: {}", e))?;

        if !transcript_chunk.trim().is_empty() {
            if !lock.active_transcript.is_empty() {
                lock.active_transcript.push(' ');
            }
            lock.active_transcript.push_str(&transcript_chunk);
        }

        (
            lock.resume_text.clone(),
            lock.job_description_text.clone(),
            lock.active_transcript.clone(),
        )
    };

    // Rule 2: 800ms silence trigger fires OpenAI synthesis handoff immediately
    if is_silence_800ms && !full_transcript.trim().is_empty() {
        app.emit("UserFinishedSpeaking", &full_transcript)
            .map_err(|e| e.to_string())?;

        // Reset active transcript for next question
        {
            if let Ok(mut lock) = state.ram_context.write() {
                lock.active_transcript.clear();
            }
        }

        // Spawn OpenAI SSE streaming task on separate Tokio thread
        let app_handle = app.clone();
        let is_streaming_flag = state.is_streaming_openai.clone();

        tokio::spawn(async move {
            if let Err(err) = trigger_openai_star_synthesis(
                app_handle,
                openai_api_key,
                full_transcript,
                resume,
                jd,
                is_streaming_flag,
            )
            .await
            {
                tracing::error!("OpenAI STAR synthesis error: {}", err);
            }
        });
    }

    Ok(())
}

/// Rule 3 & 4: OpenAI gpt-4o-mini SSE Streaming Integration with STAR Method System Prompt
pub async fn trigger_openai_star_synthesis(
    app: AppHandle,
    api_key: String,
    user_question: String,
    resume: String,
    job_description: String,
    is_streaming: Arc<RwLock<bool>>,
) -> Result<()> {
    // Set streaming active lock
    if let Ok(mut lock) = is_streaming.write() {
        *lock = true;
    }

    // Adaptive system prompt: STAR for behavioral, structured for technical
    let question_lower = user_question.to_lowercase();
    let is_behavioral = question_lower.contains("tell me about a time")
        || question_lower.contains("describe a situation")
        || question_lower.contains("give me an example")
        || question_lower.contains("how do you handle")
        || question_lower.contains("tell me about yourself")
        || question_lower.contains("walk me through")
        || question_lower.contains("biggest challenge")
        || question_lower.contains("conflict")
        || question_lower.contains("failure")
        || question_lower.contains("leadership");

    let format_instruction = if is_behavioral {
        "FORMAT: Use the STAR method (Situation, Task, Action, Result).\n\
        - Situation: 1-2 sentences with specific context.\n\
        - Task: Your responsibility.\n\
        - Action: Concrete steps YOU took (use \"I\", not \"we\").\n\
        - Result: Quantified business impact (metrics, percentages, cost savings).\n\
        Output as concise, scannable sentences separated by line breaks for live teleprompter reading."
    } else {
        "FORMAT: Structured technical answer.\n\
        - Line 1: Direct answer or architectural decision.\n\
        - Following lines: 2-4 concise points covering trade-offs, scalability, security, and cost.\n\
        - Explain WHY a technology is chosen; connect services together.\n\
        - For system design: Requirements → Architecture → Deep-dive → Failure modes → Capacity.\n\
        Output as short, scannable sentences separated by line breaks for live teleprompter reading."
    };

    let system_instruction = format!(
        "You are my real-time AI Interview Co-Pilot & Technical Architect.\n\n\
        YOUR TASK:\n\
        Answer the interview question using the candidate's Resume and target Job Description below.\n\
        Never say you are an AI. Speak as the candidate in first person.\n\n\
        {}\n\n\
        ### CANDIDATE RESUME ###\n{}\n\n\
        ### TARGET JOB DESCRIPTION ###\n{}",
        format_instruction,
        if resume.trim().is_empty() { "Not provided" } else { &resume },
        if job_description.trim().is_empty() { "Not provided" } else { &job_description }
    );

    let client = Client::new();
    let payload = json!({
        "model": "gpt-4o-mini",
        "stream": true,
        "messages": [
            { "role": "system", "content": system_instruction },
            { "role": "user", "content": user_question }
        ],
        "temperature": 0.6,
        "max_tokens": 1024
    });

    let res = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await?;

    if !res.status().is_success() {
        let err_body = res.text().await.unwrap_or_default();
        return Err(anyhow!("OpenAI API error: {}", err_body));
    }

    let mut stream = res.bytes_stream();
    let mut buffer = String::new();

    while let Some(item) = stream.next().await {
        let bytes = item?;
        let text = String::from_utf8_lossy(&bytes);
        buffer.push_str(&text);

        while let Some(pos) = buffer.find("\n\n") {
            let line = buffer[..pos].to_string();
            buffer = buffer[pos + 2..].to_string();

            for sse_line in line.lines() {
                let trimmed = sse_line.trim();
                if let Some(data) = trimmed.strip_prefix("data: ") {
                    if data.trim() == "[DONE]" {
                        app.emit("incoming_answer_complete", true).ok();
                        break;
                    }

                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(data) {
                        if let Some(chunk) = v["choices"][0]["delta"]["content"].as_str() {
                            if !chunk.is_empty() {
                                // Rule 3: Emit chunk-by-chunk Tauri IPC event for instant React rendering
                                app.emit("incoming_answer_chunk", chunk).ok();
                            }
                        }
                    }
                }
            }
        }
    }

    if let Ok(mut lock) = is_streaming.write() {
        *lock = false;
    }

    Ok(())
}

/// Rule 2: WebSocket connection to Gemini 3.1 Flash Live Preview for Live Audio Ingestion
#[tauri::command]
pub async fn start_gemini_live_websocket(
    app: AppHandle,
    state: State<'_, CopilotState>,
    gemini_api_key: String,
) -> Result<String, String> {
    let ws_url = format!(
        "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key={}",
        gemini_api_key
    );

    let active_flag = state.gemini_ws_active.clone();
    {
        let mut lock = active_flag.write().map_err(|e| e.to_string())?;
        if *lock {
            return Ok("Gemini WebSocket is already active.".to_string());
        }
        *lock = true;
    }

    let app_handle = app.clone();

    tokio::spawn(async move {
        tracing::info!("Connecting to Gemini Live WebSocket: {}", ws_url);
        match tokio_tungstenite::connect_async(&ws_url).await {
            Ok((ws_stream, _)) => {
                tracing::info!("Connected to Gemini Live WebSocket successfully.");
                let (_write, mut read) = ws_stream.split();

                while let Some(msg) = read.next().await {
                    match msg {
                        Ok(tokio_tungstenite::tungstenite::Message::Text(text)) => {
                            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) {
                                if let Some(part) = v["serverContent"]["modelTurn"]["parts"][0]["text"].as_str() {
                                    app_handle.emit("gemini_live_transcript", part).ok();
                                }
                            }
                        }
                        Ok(tokio_tungstenite::tungstenite::Message::Close(_)) => {
                            tracing::warn!("Gemini WebSocket closed.");
                            break;
                        }
                        Err(e) => {
                            tracing::error!("Gemini WebSocket read error: {}", e);
                            break;
                        }
                        _ => {}
                    }
                }
            }
            Err(e) => {
                tracing::error!("Failed to connect to Gemini Live WebSocket: {}", e);
            }
        }

        if let Ok(mut lock) = active_flag.write() {
            *lock = false;
        }
    });

    Ok("Gemini 3.1 Live WebSocket ingestion started.".to_string())
}
