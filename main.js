/**
 * Irene - Main Process Entry Point (Optimized)
 * Application lifecycle management
 */

const { app, BrowserWindow } = require('electron');

// Import modules
const FineTuneConfig = require('./src/utils/config');
const ChatHistoryDB = require('./src/database/database');
const GeminiAPI = require('./src/api/gemini-api');
const { createWindow, setupGlobalShortcuts, getUserData } = require('./src/main/window-manager');
const { initHandlers } = require('./src/main/ipc-handlers');

// Initialize services
const config = new FineTuneConfig();
const chatDB = new ChatHistoryDB();
const geminiAPI = new GeminiAPI(config);

// Initialize IPC handlers with dependencies
initHandlers(config, chatDB, geminiAPI, getUserData);

// Initialize default chat
const initializeDefaultChat = async () => {
    try {
        const chats = await chatDB.getAllChats();
        if (chats.length === 0) {
            const chatId = await chatDB.createNewChat('Welcome Chat');
            chatDB.setCurrentChat(chatId);
        } else {
            chatDB.setCurrentChat(chats[0].id);
        }
    } catch (error) {
        console.error('Default chat init error:', error);
    }
};

// App lifecycle
app.whenReady().then(() => {
    createWindow();
    initializeDefaultChat();
    setupGlobalShortcuts();
});

app.on('window-all-closed', () => {
    if (chatDB) chatDB.close();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    if (chatDB) chatDB.close();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
