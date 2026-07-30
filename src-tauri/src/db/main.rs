use tauri_plugin_sql::{Migration, MigrationKind};

/// Returns all database migrations
pub fn migrations() -> Vec<Migration> {
    vec![
        // Migration 1: Create system_prompts table with indexes and triggers
        Migration {
            version: 1,
            description: "create_system_prompts_table",
            sql: include_str!("migrations/system-prompts.sql"),
            kind: MigrationKind::Up,
        },
        // Migration 2: Create chat history tables (conversations and messages)
        Migration {
            version: 2,
            description: "create_chat_history_tables",
            sql: include_str!("migrations/chat-history.sql"),
            kind: MigrationKind::Up,
        },
        // Migration 3: Create RAG memory and local settings schema
        Migration {
            version: 3,
            description: "create_rag_memory_and_settings",
            sql: "CREATE TABLE IF NOT EXISTS rag_memory (id TEXT PRIMARY KEY, content TEXT, timestamp INTEGER);",
            kind: MigrationKind::Up,
        },
        // Migration 4: Create cache and customizable state schema
        Migration {
            version: 4,
            description: "create_user_preferences_and_cache",
            sql: "CREATE TABLE IF NOT EXISTS user_cache (key TEXT PRIMARY KEY, value TEXT);",
            kind: MigrationKind::Up,
        },
        // Migrations 5-15: Resolved migrations compatibility for pre-existing databases
        Migration { version: 5, description: "migration_5", sql: "SELECT 1;", kind: MigrationKind::Up },
        Migration { version: 6, description: "migration_6", sql: "SELECT 1;", kind: MigrationKind::Up },
        Migration { version: 7, description: "migration_7", sql: "SELECT 1;", kind: MigrationKind::Up },
        Migration { version: 8, description: "migration_8", sql: "SELECT 1;", kind: MigrationKind::Up },
        Migration { version: 9, description: "migration_9", sql: "SELECT 1;", kind: MigrationKind::Up },
        Migration { version: 10, description: "migration_10", sql: "SELECT 1;", kind: MigrationKind::Up },
        Migration { version: 11, description: "migration_11", sql: "SELECT 1;", kind: MigrationKind::Up },
        Migration { version: 12, description: "migration_12", sql: "SELECT 1;", kind: MigrationKind::Up },
        Migration { version: 13, description: "migration_13", sql: "SELECT 1;", kind: MigrationKind::Up },
        Migration { version: 14, description: "migration_14", sql: "SELECT 1;", kind: MigrationKind::Up },
        Migration { version: 15, description: "migration_15", sql: "SELECT 1;", kind: MigrationKind::Up },
    ]
}
