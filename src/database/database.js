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
        const dir = path.join(__dirname, '..', '..', 'chat_history');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        return path.join(dir, 'conversations.db');
    }

    init() {
        this.db = new sqlite3.Database(this.dbPath, (err) => {
            if (err) console.error('DB open error:', err.message);
            else {
                console.log('SQLite connected');
                this.createTables();
            }
        });
    }
    
    createTables() {
        this.db.run(`CREATE TABLE IF NOT EXISTS chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            title TEXT DEFAULT 'New Chat',
            summary TEXT
        )`, (err) => err ? console.error('Chats table error:', err.message) : this.runMigrations());

        this.db.run(`CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id INTEGER,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            message_type TEXT DEFAULT 'text',
            command_info TEXT,
            FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE
        )`);

        console.log('Tables verified');
    }

    runMigrations() {
        this.db.all("PRAGMA table_info(chats)", (err, rows) => {
            if (err) return console.error('Schema check error:', err.message);
            
            if (!rows.some(r => r.name === 'summary')) {
                console.log('Adding summary column...');
                this.db.run("ALTER TABLE chats ADD COLUMN summary TEXT", 
                    (err) => err ? console.error('Migration error:', err.message) : console.log('Summary added'));
            }
        });
    }

    createNewChat(title = null) {
        return new Promise((resolve, reject) => {
            const t = title || `Chat ${new Date().toLocaleString()}`;
            this.db.run('INSERT INTO chats (title) VALUES (?)', [t], function(err) {
                err ? reject(err) : (console.log(`Chat created: ${this.lastID}`), resolve(this.lastID));
            });
        });
    }

    setCurrentChat(chatId) {
        this.currentChatId = chatId;
        console.log(`Current chat: ${chatId}`);
    }

    addMessage(role, content, messageType = 'text', commandInfo = null) {
        if (!this.currentChatId) {
            console.warn('No current chat');
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO messages (chat_id, role, content, message_type, command_info) VALUES (?, ?, ?, ?, ?)`,
                [this.currentChatId, role, content, messageType, commandInfo],
                function(err) {
                    err ? reject(err) : (console.log(`Message: ${this.lastID}`), resolve(this.lastID));
                }
            );
        });
    }

    getChatHistory(limit = 20) {
        if (!this.currentChatId) return Promise.resolve([]);

        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT role, content, message_type, command_info, timestamp FROM messages 
                 WHERE chat_id = ? ORDER BY timestamp ASC LIMIT ?`,
                [this.currentChatId, limit],
                (err, rows) => err ? reject(err) : resolve(rows || [])
            );
        });
    }

    getAllChats() {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT id, title, created_at, updated_at, summary FROM chats ORDER BY updated_at DESC`,
                (err, rows) => err ? reject(err) : resolve(rows || [])
            );
        });
    }

    deleteChat(chatId) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM chats WHERE id = ?', [chatId], 
                (err) => err ? reject(err) : resolve());
        });
    }

    updateChatTitle(title) {
        if (!this.currentChatId) return Promise.resolve();

        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE chats SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [title, this.currentChatId],
                (err) => err ? reject(err) : resolve()
            );
        });
    }

    updateConversationSummary(summary) {
        if (!this.currentChatId) return Promise.resolve();

        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE chats SET summary = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [summary, this.currentChatId],
                (err) => err ? reject(err) : resolve()
            );
        });
    }

    async needsSummarization() {
        if (!this.currentChatId) return false;
        const count = await new Promise((resolve, reject) => {
            this.db.get('SELECT COUNT(*) as count FROM messages WHERE chat_id = ?',
                [this.currentChatId], (err, row) => err ? reject(err) : resolve(row.count));
        });
        return count > 30;
    }

    async needsTitleGeneration() {
        if (!this.currentChatId) return false;
        const chat = await new Promise((resolve, reject) => {
            this.db.get('SELECT title FROM chats WHERE id = ?',
                [this.currentChatId], (err, row) => err ? reject(err) : resolve(row));
        });
        return chat && chat.title.startsWith('Chat ');
    }

    async getMessagesForTitleGeneration() {
        if (!this.currentChatId) return [];
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT role, content FROM messages WHERE chat_id = ? ORDER BY timestamp ASC LIMIT 4',
                [this.currentChatId], (err, rows) => err ? reject(err) : resolve(rows || [])
            );
        });
    }

    async formatHistoryForContext(history) {
        if (!history || history.length === 0) return '';
        
        return history.map(msg => {
            const roleLabel = msg.role === 'user' ? 'User' : (msg.role === 'assistant' ? 'Assistant' : 'System');
            return `${roleLabel}: ${msg.content}`;
        }).join('\n\n') + '\n\n';
    }

    close() {
        if (this.db) {
            this.db.close((err) => {
                err ? console.error('DB close error:', err.message) : console.log('DB closed');
            });
        }
    }
}

module.exports = ChatHistoryDB;
