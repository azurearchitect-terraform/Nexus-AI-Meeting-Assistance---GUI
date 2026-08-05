use serde::{Deserialize, Serialize};
use std::fs;
use tauri::{AppHandle, Manager, Runtime};
use rusqlite::{params, Connection};
use walkdir::WalkDir;
use std::path::PathBuf;
use std::io::Read;
use dotext::{Docx, MsDoc, Pptx};

#[derive(Debug, Serialize, Deserialize)]
pub struct MemoryChunk {
    pub id: String,
    pub content: String,
    pub metadata: Option<String>,
    pub score: f32,
}

fn get_db_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&app_dir).ok();
    Ok(app_dir.join("documents.db"))
}

fn get_documents_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let docs_dir = app_dir.join("documents");
    fs::create_dir_all(&docs_dir).ok();
    Ok(docs_dir)
}

fn init_db(db_path: &PathBuf) -> Result<Connection, String> {
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    // Create FTS5 virtual table
    conn.execute(
        "CREATE VIRTUAL TABLE IF NOT EXISTS documents USING fts5(filename, content, tokenize='porter');",
        [],
    ).map_err(|e| e.to_string())?;
    Ok(conn)
}

#[tauri::command]
pub async fn search_memory<R: Runtime>(app: AppHandle<R>, query: String, limit: Option<usize>) -> Result<Vec<MemoryChunk>, String> {
    let max_results = limit.unwrap_or(5);
    let mut results = Vec::new();
    
    if query.trim().is_empty() {
        return Ok(results);
    }

    let db_path = get_db_path(&app)?;
    let conn = init_db(&db_path)?;

    // Stop words to filter out before running FTS MATCH query
    let stop_words = ["tell", "me", "something", "about", "your", "self", "yourself", "what", "is", "are", "you", "the", "a", "an", "and", "or", "in", "on", "of", "to", "for", "with"];
    
    // Clean query text: replace non-alphanumeric with spaces
    let safe_query: String = query.chars().map(|c| if c.is_alphanumeric() { c } else { ' ' }).collect();
    let query_words: Vec<&str> = safe_query
        .split_whitespace()
        .collect();

    // Significant terms excluding stop words
    let significant_terms: Vec<&str> = query_words
        .iter()
        .cloned()
        .filter(|w| !stop_words.contains(&w.to_lowercase().as_str()) && w.len() > 1)
        .collect();

    let match_expr = if !significant_terms.is_empty() {
        significant_terms.join(" OR ")
    } else {
        query_words.join(" OR ")
    };
    
    println!("[RAG] search_memory query: '{}', match_expr: '{}', significant_terms: {:?}", query, match_expr, significant_terms);

    if !match_expr.is_empty() {
        if let Ok(mut stmt) = conn.prepare(
            "SELECT filename, content, rank FROM documents WHERE documents MATCH ? ORDER BY rank LIMIT ?"
        ) {
            if let Ok(rows) = stmt.query_map(params![match_expr, max_results as i64], |row| {
                let filename: String = row.get(0)?;
                let content: String = row.get(1)?;
                let rank: f64 = row.get(2)?;
                Ok(MemoryChunk {
                    id: filename.clone(),
                    content,
                    metadata: Some(format!("source: {}", filename)),
                    score: rank as f32,
                })
            }) {
                for row in rows {
                    if let Ok(chunk) = row {
                        results.push(chunk);
                    }
                }
            }
        }
    }
    
    // Fallback 1: LIKE search on terms
    if results.is_empty() {
        for term in significant_terms.iter().chain(query_words.iter()) {
            let like_expr = format!("%{}%", term);
            if let Ok(mut fallback_stmt) = conn.prepare(
                "SELECT filename, content FROM documents WHERE content LIKE ? LIMIT ?"
            ) {
                if let Ok(fallback_rows) = fallback_stmt.query_map(params![like_expr, max_results as i64], |row| {
                    let filename: String = row.get(0)?;
                    let content: String = row.get(1)?;
                    Ok(MemoryChunk {
                        id: filename.clone(),
                        content,
                        metadata: Some(format!("source: {}", filename)),
                        score: 0.0,
                    })
                }) {
                    for row in fallback_rows {
                        if let Ok(chunk) = row {
                            results.push(chunk);
                        }
                    }
                }
            }
            if !results.is_empty() {
                break;
            }
        }
    }

    // Fallback 2: General self/profile query or single doc in db -> Return top chunks directly
    if results.is_empty() {
        let is_general_intro = query.to_lowercase().contains("tell") || 
                              query.to_lowercase().contains("about") || 
                              query.to_lowercase().contains("yourself") ||
                              query.to_lowercase().contains("profile") ||
                              query.to_lowercase().contains("experience");
        if is_general_intro {
            if let Ok(mut all_stmt) = conn.prepare(
                "SELECT filename, content FROM documents LIMIT ?"
            ) {
                if let Ok(all_rows) = all_stmt.query_map(params![max_results as i64], |row| {
                    let filename: String = row.get(0)?;
                    let content: String = row.get(1)?;
                    Ok(MemoryChunk {
                        id: filename.clone(),
                        content,
                        metadata: Some(format!("source: {}", filename)),
                        score: 0.0,
                    })
                }) {
                    for row in all_rows {
                        if let Ok(chunk) = row {
                            results.push(chunk);
                        }
                    }
                }
            }
        }
    }

    println!("[RAG] search_memory returning {} results", results.len());
    Ok(results)
}

#[tauri::command]
pub async fn store_memory(_content: String, _metadata: Option<String>) -> Result<String, String> {
    Ok("ok".to_string())
}

#[tauri::command]
pub fn scan_documents<R: Runtime>(app: AppHandle<R>, dir_path: Option<String>) -> Result<String, String> {
    let docs_dir = match dir_path {
        Some(path) if !path.trim().is_empty() => PathBuf::from(path),
        _ => get_documents_dir(&app)?,
    };
    
    println!("[RAG] Scanning documents in: {:?}", docs_dir);
    
    let db_path = get_db_path(&app)?;
    let conn = init_db(&db_path)?;

    // Clear existing index to avoid duplicates (naive approach for MVP)
    conn.execute("DELETE FROM documents", []).map_err(|e| e.to_string())?;

    let mut count = 0;

    for entry in WalkDir::new(&docs_dir).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_file() {
            let filename = path.file_name().unwrap_or_default().to_string_lossy().to_string();
            let ext = path.extension().unwrap_or_default().to_string_lossy().to_lowercase();
            
            let content = match ext.as_str() {
                "txt" | "md" | "json" | "csv" => {
                    std::fs::read_to_string(path).unwrap_or_default()
                },
                "pdf" => {
                    pdf_extract::extract_text(path).unwrap_or_default()
                },
                "docx" => {
                    let mut content = String::new();
                    if let Ok(mut doc) = Docx::open(path) {
                        let _ = doc.read_to_string(&mut content);
                    }
                    content
                },
                "pptx" | "ppt" => {
                    let mut content = String::new();
                    if let Ok(mut doc) = Pptx::open(path) {
                        let _ = doc.read_to_string(&mut content);
                    }
                    content
                },
                _ => continue,
            };

            if !content.trim().is_empty() {
                // Chunk the content roughly every 1000 chars for better context injection
                let chunks: Vec<&str> = content.split("\n\n").collect();
                let mut current_chunk = String::new();
                for chunk in chunks {
                    current_chunk.push_str(chunk);
                    current_chunk.push_str("\n\n");
                    if current_chunk.len() > 1000 {
                        conn.execute(
                            "INSERT INTO documents (filename, content) VALUES (?1, ?2)",
                            params![filename, current_chunk],
                        ).ok();
                        current_chunk.clear();
                        count += 1;
                    }
                }
                if !current_chunk.trim().is_empty() {
                    conn.execute(
                        "INSERT INTO documents (filename, content) VALUES (?1, ?2)",
                        params![filename, current_chunk],
                    ).ok();
                    count += 1;
                }
            }
        }
    }

    Ok(format!("Scanned and indexed {} document chunks.", count))
}

#[tauri::command]
pub fn open_documents_folder<R: Runtime>(app: AppHandle<R>, dir_path: Option<String>) -> Result<(), String> {
    let target_dir = match dir_path {
        Some(path) => PathBuf::from(path),
        None => get_documents_dir(&app)?,
    };
    use tauri_plugin_opener::OpenerExt;
    app.opener().open_path(target_dir.to_string_lossy().to_string(), None::<&str>).map_err(|e| e.to_string())?;
    Ok(())
}
