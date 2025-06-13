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
            title TEXT DEFAULT 'New Chat'
        )`);

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
            );
        });
    }

    // Update chat title
    updateChatTitle(chatId, title) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE chats SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [title, chatId],
                function(err) {
                    if (err) {
                        console.error('Error updating chat title:', err);
                        reject(err);
                    } else {
                        resolve(this.changes);
                    }
                }
            );
        });
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

    // Format chat history for Gemini context
    formatHistoryForContext(history, maxLength = 2000) {
        if (!history || history.length === 0) {
            return '';
        }

        let context = '\n\nPrevious conversation context:\n';
        let totalLength = context.length;

        for (const message of history.reverse()) { // Start from most recent
            const messageText = `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}\n`;
            
            if (totalLength + messageText.length > maxLength) {
                break;
            }
            
            context = messageText + context.substring(context.indexOf('\n\nPrevious'));
            totalLength += messageText.length;
        }

        return context;
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
