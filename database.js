const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class ChatHistoryDB {
    constructor() {
        this.dbPath = this.ensureDBDirectory();
        this.db = null;
        this.currentChatId = null;
        this.init();
    }

    ensureDBDirectory() {
        const chatHistoryDir = path.join(__dirname, 'chat_history');
        if (!fs.existsSync(chatHistoryDir)) {
            fs.mkdirSync(chatHistoryDir, { recursive: true });
        }
        return path.join(chatHistoryDir, 'conversations.db');
    }

    init() {
        this.db = new sqlite3.Database(this.dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err.message);
            } else {
                console.log('Connected to SQLite database for chat history');
                this.createTables();
            }
        });
    }    
    createTables() {
        // Create chats table
        this.db.run(`CREATE TABLE IF NOT EXISTS chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            title TEXT DEFAULT 'New Chat',
            summary TEXT
        )`, (err) => {
            if (err) {
                console.error('Error creating chats table:', err.message);
            } else {
                this.runMigrations();
            }
        });

        // Create messages table
        this.db.run(`CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id INTEGER,
            role TEXT NOT NULL, -- 'user', 'assistant', 'system'
            content TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            message_type TEXT DEFAULT 'text', -- 'text', 'command', 'command_result'
            command_info TEXT, -- JSON string for command details
            FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE
        )`);

        console.log('Chat history tables created/verified');
    }

    // Run database migrations to handle schema changes
    runMigrations() {
        // Check if summary column exists in chats table
        this.db.all("PRAGMA table_info(chats)", (err, rows) => {
            if (err) {
                console.error('Error checking table schema:', err.message);
                return;
            }
            
            const summaryColumnExists = rows.some(row => row.name === 'summary');
            
            if (!summaryColumnExists) {
                console.log('Adding summary column to chats table...');
                this.db.run("ALTER TABLE chats ADD COLUMN summary TEXT", (err) => {
                    if (err) {
                        console.error('Error adding summary column:', err.message);
                    } else {
                        console.log('Summary column added successfully');
                    }
                });
            }
        });
    }

    // Create a new chat session
    createNewChat(title = null) {
        return new Promise((resolve, reject) => {
            const chatTitle = title || `Chat ${new Date().toLocaleString()}`;
            
            this.db.run(
                'INSERT INTO chats (title) VALUES (?)',
                [chatTitle],
                function(err) {
                    if (err) {
                        console.error('Error creating new chat:', err);
                        reject(err);
                    } else {
                        console.log(`New chat created with ID: ${this.lastID}`);
                        resolve(this.lastID);
                    }
                }
            );
        });
    }

    // Set current active chat
    setCurrentChat(chatId) {
        this.currentChatId = chatId;
        console.log(`Current chat set to: ${chatId}`);
    }

    // Add a message to the current chat
    addMessage(role, content, messageType = 'text', commandInfo = null) {
        if (!this.currentChatId) {
            console.warn('No current chat set, message not saved');
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO messages (chat_id, role, content, message_type, command_info) 
                 VALUES (?, ?, ?, ?, ?)`,
                [this.currentChatId, role, content, messageType, commandInfo],
                function(err) {
                    if (err) {
                        console.error('Error adding message:', err);
                        reject(err);
                    } else {
                        console.log(`Message added with ID: ${this.lastID}`);
                        resolve(this.lastID);
                    }
                }
            );
        });
    }

    // Get chat history for context (last N messages)
    getChatHistory(limit = 20) {
        if (!this.currentChatId) {
            return Promise.resolve([]);
        }

        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT role, content, message_type, command_info, timestamp 
                 FROM messages 
                 WHERE chat_id = ? 
                 ORDER BY timestamp ASC 
                 LIMIT ?`,
                [this.currentChatId, limit],
                (err, rows) => {
                    if (err) {
                        console.error('Error getting chat history:', err);
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    // Get all chats (for chat list)
    getAllChats() {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT c.id, c.title, c.created_at, c.updated_at,
                        COUNT(m.id) as message_count,
                        MAX(m.timestamp) as last_message_time
                 FROM chats c
                 LEFT JOIN messages m ON c.id = m.chat_id
                 GROUP BY c.id, c.title, c.created_at, c.updated_at
                 ORDER BY COALESCE(last_message_time, c.created_at) DESC`,
                [],
                (err, rows) => {
                    if (err) {
                        console.error('Error getting all chats:', err);
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );        });
    }

    // Delete a chat
    deleteChat(chatId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM chats WHERE id = ?',
                [chatId],
                function(err) {
                    if (err) {
                        console.error('Error deleting chat:', err);
                        reject(err);
                    } else {
                        console.log(`Chat ${chatId} deleted`);
                        resolve(this.changes);
                    }
                }
            );
        });
    }        
    // Format chat history for Gemini context with summary support
    async formatHistoryForContext(history, maxLength = 2000) {
        if (!history || history.length === 0) {
            return '';
        }

        let context = '';
        let totalLength = 0;

        // Try to get conversation summary first
        const summary = await this.getConversationSummary();
        if (summary) {
            const summaryText = `\n\nConversation Summary:\n${summary}\n\nRecent Messages:\n`;
            context += summaryText;
            totalLength += summaryText.length;
        } else {
            const headerText = '\n\nPrevious conversation context:\n';
            context += headerText;
            totalLength += headerText.length;
        }

        let messages = [];
        // Take only the most recent messages to fit within limit
        const recentMessages = summary ? history.slice(-4) : history; // Fewer recent messages if we have summary

        // Process messages in chronological order (oldest first)
        for (const message of recentMessages) {
            // Skip system messages (commands) for context to avoid clutter
            if (message.role === 'system') {
                continue;
            }
            
            const roleLabel = message.role === 'user' ? 'User' : 'Assistant';
            const messageText = `${roleLabel}: ${message.content}\n`;
            
            // Check if adding this message would exceed the limit
            if (totalLength + messageText.length > maxLength) {
                break;
            }
            
            messages.push(messageText);
            totalLength += messageText.length;
        }

        // If we have messages, add them to context
        if (messages.length > 0) {
            context += messages.join('');
            context += '\n--- End of context ---\n\n';
        } else if (!summary) {
            return ''; // No relevant history to include
        }

        return context;
    }

    // Get conversation summary for long chats
    async getConversationSummary(chatId = null) {
        const targetChatId = chatId || this.currentChatId;
        if (!targetChatId) return null;

        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT summary, updated_at FROM chats WHERE id = ?',
                [targetChatId],
                (err, row) => {
                    if (err) {
                        console.error('Error getting conversation summary:', err);
                        reject(err);
                    } else {
                        resolve(row ? row.summary : null);
                    }
                }
            );
        });
    }

    // Update conversation summary
    async updateConversationSummary(summary, chatId = null) {
        const targetChatId = chatId || this.currentChatId;
        if (!targetChatId) return false;

        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE chats SET summary = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [summary, targetChatId],
                function(err) {
                    if (err) {
                        console.error('Error updating conversation summary:', err);
                        reject(err);
                    } else {
                        console.log('Conversation summary updated for chat:', targetChatId);
                        resolve(this.changes > 0);
                    }
                }
            );
        });
    }

    // Check if summarization is needed (every 3 exchanges = 6 messages)
    async needsSummarization(chatId = null) {
        const targetChatId = chatId || this.currentChatId;
        if (!targetChatId) return false;

        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT COUNT(*) as count FROM messages 
                 WHERE chat_id = ? AND role IN ('user', 'assistant')`,
                [targetChatId],
                (err, row) => {
                    if (err) {
                        console.error('Error checking message count:', err);
                        reject(err);
                    } else {
                        // Need summary every 6 messages (3 exchanges)
                        const needsSummary = row.count > 0 && row.count % 6 === 0;
                        resolve(needsSummary);
                    }
                }
            );
        });
    }

    // Check if title generation is needed (after 2 exchanges = 4 messages)
    async needsTitleGeneration(chatId = null) {
        const targetChatId = chatId || this.currentChatId;
        if (!targetChatId) return false;

        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT COUNT(*) as count, c.title FROM messages m
                 JOIN chats c ON m.chat_id = c.id
                 WHERE m.chat_id = ? AND m.role IN ('user', 'assistant')`,
                [targetChatId],
                (err, row) => {
                    if (err) {
                        console.error('Error checking title generation need:', err);
                        reject(err);
                    } else {
                        // Need title generation after 4 messages (2 exchanges) and only if title is default
                        const needsTitle = row.count === 4 && row.title && row.title.startsWith('Chat ');
                        resolve(needsTitle);
                    }
                }
            );
        });
    }

    // Update chat title
    async updateChatTitle(title, chatId = null) {
        const targetChatId = chatId || this.currentChatId;
        if (!targetChatId) return false;

        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE chats SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [title, targetChatId],
                function(err) {
                    if (err) {
                        console.error('Error updating chat title:', err);
                        reject(err);
                    } else {
                        console.log('Chat title updated for chat:', targetChatId);
                        resolve(this.changes > 0);
                    }
                }
            );
        });
    }

    // Get messages for title generation (first few messages)
    async getMessagesForTitleGeneration(chatId = null) {
        const targetChatId = chatId || this.currentChatId;
        if (!targetChatId) return [];

        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT role, content FROM messages 
                 WHERE chat_id = ? AND role IN ('user', 'assistant')
                 ORDER BY timestamp ASC 
                 LIMIT 4`,
                [targetChatId],
                (err, rows) => {
                    if (err) {
                        console.error('Error getting messages for title generation:', err);
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    // Close database connection
    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err);
                } else {
                    console.log('Database connection closed');
                }
            });
        }
    }
}

module.exports = ChatHistoryDB;
