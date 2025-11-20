/**
 * IPC Handlers - Optimized
 * Handles all inter-process communication between renderer and main
 */

const { ipcMain } = require('electron');
const { exec } = require('child_process');

let config, chatDB, geminiAPI, getUserDataFn;

function initHandlers(cfg, db, api, userDataFn) {
    config = cfg;
    chatDB = db;
    geminiAPI = api;
    getUserDataFn = userDataFn;
}

// AI Communication
ipcMain.handle('call-gemini-api', async (e, message, images = [], selectedModel = null) => {
    try {
        console.log(`\n📨 API: "${message}"`);
        console.log(`📸 Images: ${images?.length || 0}`);
        if (images?.length > 0) {
            console.log('📊 Lengths:', images.map(img => img?.length || 0));
        }
        
        if (selectedModel) geminiAPI.setModel(selectedModel);
        
        const history = await chatDB.getChatHistory(15);
        const userData = getUserDataFn();
        
        if (await chatDB.needsSummarization()) {
            const summary = await geminiAPI.generateSummary(history);
            await chatDB.updateConversationSummary(summary);
        }
        
        let contextFromHistory = await chatDB.formatHistoryForContext(history);
        if (userData.name || userData.preferences) {
            contextFromHistory = `User Info: ${userData.name ? 'Name: ' + userData.name + '. ' : ''}${userData.preferences ? 'Preferences: ' + userData.preferences : ''}\n\n${contextFromHistory}`;
        }
        const messageWithContext = contextFromHistory 
            ? contextFromHistory + 'Current message:\n' + message
            : message;
        
        if (chatDB.currentChatId) {
            await chatDB.addMessage('user', message);
        }
        
        const formattedMessage = config.formatMessage(messageWithContext);
        console.log(`🤖 Calling with ${images?.length || 0} image(s)`);
        const apiResponse = await geminiAPI.generateContent(formattedMessage, images);
        const response = typeof apiResponse === 'string' ? apiResponse : apiResponse.text;
        const tokenUsage = typeof apiResponse === 'object' ? apiResponse.tokenUsage : null;
        
        if (tokenUsage) {
            console.log(`📊 Tokens - In: ${tokenUsage.promptTokenCount}, Out: ${tokenUsage.candidatesTokenCount}, Total: ${tokenUsage.totalTokenCount}`);
        }
        
        if (chatDB.currentChatId) {
            await chatDB.addMessage('assistant', response);
            
            if (await chatDB.needsTitleGeneration()) {
                const messages = await chatDB.getMessagesForTitleGeneration();
                const title = await geminiAPI.generateTitle(messages);
                await chatDB.updateChatTitle(title);
            }
        }
        
        return { success: true, response, tokenUsage };
        
    } catch (error) {
        console.error('API failed:', error.message);
        const fallbackResponse = config.getFallbackResponse();
        
        if (chatDB.currentChatId) {
            await chatDB.addMessage('assistant', fallbackResponse + ' (fallback)');
        }
        
        return { success: true, response: fallbackResponse, isFallback: true };
    }
});

// System Command Execution
ipcMain.handle('execute-command', async (e, command) => {
    return new Promise((resolve) => {
        const sanitized = command.trim();
        
        if (!sanitized) {
            resolve({ success: false, error: 'Empty command' });
            return;
        }
        
        const opts = { timeout: 30000, maxBuffer: 1024 * 1024, encoding: 'utf8' };
        
        exec(sanitized, opts, async (error, stdout, stderr) => {
            const cmdInfo = JSON.stringify({
                command: sanitized,
                timestamp: new Date().toISOString(),
                success: !error
            });
            
            if (error) {
                const errMsg = stderr ? `${error.message}\n\nError output:\n${stderr}` : error.message;
                
                if (chatDB.currentChatId) {
                    await chatDB.addMessage('system', `Command failed: ${sanitized}\nError: ${errMsg}`, 'command_result', cmdInfo);
                }
                
                resolve({ success: false, error: errMsg, exitCode: error.code });
            } else {
                let output = '';
                if (stdout) output += stdout;
                if (stderr) {
                    if (output) output += '\n--- Warnings/Info ---\n';
                    output += stderr;
                }
                
                const finalOutput = output || '(Command completed with no output)';
                
                if (chatDB.currentChatId) {
                    await chatDB.addMessage('system', `Command executed: ${sanitized}\nOutput: ${finalOutput}`, 'command_result', cmdInfo);
                }
                
                resolve({ success: true, output: finalOutput, hasStderr: !!stderr });
            }
        });
    });
});

// Chat Management
ipcMain.handle('create-new-chat', async (e, title) => {
    try {
        const chatId = await chatDB.createNewChat(title);
        chatDB.setCurrentChat(chatId);
        return { success: true, chatId };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('load-chat', async (e, chatId) => {
    try {
        chatDB.setCurrentChat(chatId);
        const history = await chatDB.getChatHistory(50);
        return { success: true, history };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-all-chats', async () => {
    try {
        const chats = await chatDB.getAllChats();
        return { success: true, chats };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('delete-chat', async (e, chatId) => {
    try {
        await chatDB.deleteChat(chatId);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-current-chat-id', async () => {
    return { success: true, chatId: chatDB.currentChatId };
});

ipcMain.handle('reload-config', async () => {
    try {
        config.reload();
        return { success: true, message: 'Configuration reloaded successfully' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

module.exports = { initHandlers };
