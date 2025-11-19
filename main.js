/**
 * Irene - Main Process Entry Point
 * Manages application window and coordinates between UI and backend services
 */

const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');

// Import organized modules
const FineTuneConfig = require('./src/utils/config');
const ChatHistoryDB = require('./src/database/database');
const GeminiAPI = require('./src/api/gemini-api');

// ============================================================================
// Global State
// ============================================================================

let mainWindow;
let isExpanded = true; // Start expanded (chat UI visible by default)
let config;
let chatDB;
let geminiAPI;

// ============================================================================
// Initialization
// ============================================================================

// Initialize configuration, database, and API client
config = new FineTuneConfig();
chatDB = new ChatHistoryDB();
geminiAPI = new GeminiAPI(config);

// ============================================================================
// User Data Management (Persistent Across Chats)
// ============================================================================

let persistentUserData = {
    name: '',
    preferences: '',
    vibrancy: 'appearance-based'
};

function getVibrancyFromStorage() {
    return 'appearance-based'; // Always use appearance-based
}

function setVibrancyInStorage(vibrancy) {
    persistentUserData.vibrancy = vibrancy;
}

function getUserData() {
    return persistentUserData;
}

ipcMain.handle('set-user-data', (event, data) => {
    persistentUserData = { ...persistentUserData, ...data };
    return persistentUserData;
});

ipcMain.handle('get-user-data', () => {
    return persistentUserData;
});

// ============================================================================
// Window Management
// ============================================================================

/**
 * Create the main application window
 * AR overlay with frameless, transparent design
 */
function createWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    
    // Iron Man-style HUD dimensions
    const hudWidth = 900;
    const hudHeight = 700;

    mainWindow = new BrowserWindow({
        width: hudWidth,
        height: hudHeight,
        center: true,
        frame: false,              // Frameless for AR overlay
        transparent: true,          // Transparent background
        alwaysOnTop: true,          // HUD behavior
        resizable: true,            // Allow resizing
        skipTaskbar: true,          // Don't show in taskbar
        show: false,                // Don't show until ready
        title: 'Irene',             // Window title
        titleBarStyle: 'hidden',    // Hide title bar completely
        backgroundColor: 'rgba(255, 255, 255, 0)', // Fully transparent
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // Apply saved vibrancy effect
    const savedVibrancy = getVibrancyFromStorage();
    try {
        mainWindow.setVibrancy(savedVibrancy);
    } catch (error) {
        // Vibrancy not supported on this platform
    }

    mainWindow.loadFile('index.html');
    
    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
}

/**
 * Toggle window visibility (ESC to hide/show)
 */
ipcMain.handle('toggle-window', () => {
    if (mainWindow.isVisible()) {
        mainWindow.hide();
        isExpanded = false;
    } else {
        mainWindow.show();
        mainWindow.focus();
        isExpanded = true;
    }
    return isExpanded;
});

/**
 * Show window (called externally)
 */
ipcMain.handle('show-window', () => {
    if (!mainWindow.isVisible()) {
        mainWindow.show();
        mainWindow.focus();
        isExpanded = true;
    }
    return isExpanded;
});

/**
 * Enable/disable click-through for transparent areas
 */
ipcMain.handle('set-ignore-mouse', (event, ignore) => {
    mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
    return ignore;
});

/**
 * Adjust window transparency
 */
ipcMain.handle('set-transparency', (event, level) => {
    mainWindow.setOpacity(level);
    return level;
});

/**
 * Toggle always-on-top
 */
ipcMain.handle('set-always-on-top', (event, alwaysOnTop) => {
    mainWindow.setAlwaysOnTop(alwaysOnTop);
    return alwaysOnTop;
});

/**
 * Hide window
 */
ipcMain.handle('hide-window', () => {
    mainWindow.hide();
    return true;
});

/**
 * Set vibrancy effect
 */
ipcMain.handle('set-vibrancy', (event, type) => {
    try {
        if (type === 'none') {
            mainWindow.setVibrancy(null);
        } else {
            mainWindow.setVibrancy(type);
        }
        setVibrancyInStorage(type);
        return { success: true, type };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

/**
 * Take screenshot of entire screen excluding this app window
 */
ipcMain.handle('trigger-screenshot', async () => {
    try {
        const { screen, desktopCapturer } = require('electron');
        
        // Hide our window temporarily
        const wasVisible = mainWindow.isVisible();
        if (wasVisible) {
            mainWindow.hide();
        }
        
        // Wait a bit for window to hide
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Get screen sources
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: screen.getPrimaryDisplay().size
        });
        
        if (sources.length > 0) {
            const screenshot = sources[0].thumbnail.toDataURL();
            
            // Show window again
            if (wasVisible) {
                mainWindow.show();
            }
            
            return { success: true, screenshot };
        }
        
        // Show window again if it was visible
        if (wasVisible) {
            mainWindow.show();
        }
        
        return { success: false, error: 'No screen sources found' };
    } catch (error) {
        // Show window again on error
        if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
            mainWindow.show();
        }
        return { success: false, error: error.message };
    }
});

// ============================================================================
// AI Communication
// ============================================================================

/**
 * Handle incoming messages from the renderer process
 * Sends to Gemini API and manages chat history
 */
ipcMain.handle('call-gemini-api', async (event, message, images = [], selectedModel = null) => {
    try {
        console.log(`\n📨 API Call - Message: "${message}"`);
        console.log(`📸 Images received: ${images ? images.length : 0}`);
        if (images && images.length > 0) {
            console.log('📊 Image data lengths:', images.map(img => img ? img.length : 0));
        }
        
        // Set model if specified
        if (selectedModel) {
            geminiAPI.setModel(selectedModel);
        }
        
        // Get ONLY current chat history (limited context per chat)
        const history = await chatDB.getChatHistory(15);
        
        // Get persistent user data (name, preferences)
        const userData = getUserData();
        
        // Check if we need to summarize
        if (await chatDB.needsSummarization()) {
            const summary = await geminiAPI.generateSummary(history);
            await chatDB.updateConversationSummary(summary);
        }
        
        // Format message with LIMITED context + persistent user data
        let contextFromHistory = await chatDB.formatHistoryForContext(history);
        if (userData.name || userData.preferences) {
            contextFromHistory = `User Info: ${userData.name ? 'Name: ' + userData.name + '. ' : ''}${userData.preferences ? 'Preferences: ' + userData.preferences : ''}\n\n${contextFromHistory}`;
        }
        const messageWithContext = contextFromHistory 
            ? contextFromHistory + 'Current message:\n' + message
            : message;
        
        // Save user message
        if (chatDB.currentChatId) {
            await chatDB.addMessage('user', message);
        }
        
        // Get AI response (with images if provided)
        const formattedMessage = config.formatMessage(messageWithContext);
        console.log(`🤖 Calling Gemini API with ${images && images.length > 0 ? images.length + ' image(s)' : 'text only'}`);
        const apiResponse = await geminiAPI.generateContent(formattedMessage, images);
        const response = typeof apiResponse === 'string' ? apiResponse : apiResponse.text;
        const tokenUsage = typeof apiResponse === 'object' ? apiResponse.tokenUsage : null;
        
        if (tokenUsage) {
            console.log(`📊 Token Usage - Input: ${tokenUsage.promptTokenCount}, Output: ${tokenUsage.candidatesTokenCount}, Total: ${tokenUsage.totalTokenCount}`);
        }
        
        // Save assistant response
        if (chatDB.currentChatId) {
            await chatDB.addMessage('assistant', response);
            
            // Generate title if needed
            if (await chatDB.needsTitleGeneration()) {
                const messages = await chatDB.getMessagesForTitleGeneration();
                const title = await geminiAPI.generateTitle(messages);
                await chatDB.updateChatTitle(title);
            }
        }
        
        return { success: true, response, tokenUsage };
        
    } catch (error) {
        console.error('API call failed:', error.message);
        
        // Use fallback response
        const fallbackResponse = config.getFallbackResponse();
        
        if (chatDB.currentChatId) {
            await chatDB.addMessage('assistant', fallbackResponse + ' (fallback)');
        }
        
        return { success: true, response: fallbackResponse, isFallback: true };
    }
});

// ============================================================================
// System Command Execution
// ============================================================================

/**
 * Execute system commands safely with timeout and validation
 */
ipcMain.handle('execute-command', async (event, command) => {
    return new Promise((resolve) => {
        const sanitizedCommand = command.trim();
        
        if (!sanitizedCommand) {
            resolve({ success: false, error: 'Empty command' });
            return;
        }
        
        const execOptions = {
            timeout: 30000, // 30 second timeout
            maxBuffer: 1024 * 1024, // 1MB max buffer
            encoding: 'utf8'
        };
        
        exec(sanitizedCommand, execOptions, async (error, stdout, stderr) => {
            const commandInfo = JSON.stringify({
                command: sanitizedCommand,
                timestamp: new Date().toISOString(),
                success: !error
            });
            
            if (error) {
                const errorMessage = stderr ? `${error.message}\n\nError output:\n${stderr}` : error.message;
                
                // Save failed command
                if (chatDB.currentChatId) {
                    await chatDB.addMessage('system', `Command failed: ${sanitizedCommand}\nError: ${errorMessage}`, 'command_result', commandInfo);
                }
                
                resolve({ 
                    success: false, 
                    error: errorMessage,
                    exitCode: error.code
                });
            } else {
                // Combine stdout and stderr
                let output = '';
                if (stdout) output += stdout;
                if (stderr) {
                    if (output) output += '\n--- Warnings/Info ---\n';
                    output += stderr;
                }
                
                const finalOutput = output || '(Command completed with no output)';
                
                // Save successful command
                if (chatDB.currentChatId) {
                    await chatDB.addMessage('system', `Command executed: ${sanitizedCommand}\nOutput: ${finalOutput}`, 'command_result', commandInfo);
                }
                
                resolve({ 
                    success: true, 
                    output: finalOutput,
                    hasStderr: !!stderr
                });
            }
        });
    });
});

// ============================================================================
// Chat Management
// ============================================================================

/**
 * Create a new chat session
 */
ipcMain.handle('create-new-chat', async (event, title) => {
    try {
        const chatId = await chatDB.createNewChat(title);
        chatDB.setCurrentChat(chatId);
        return { success: true, chatId };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

/**
 * Load an existing chat by ID
 */
ipcMain.handle('load-chat', async (event, chatId) => {
    try {
        chatDB.setCurrentChat(chatId);
        const history = await chatDB.getChatHistory(50);
        return { success: true, history };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

/**
 * Get all chat sessions
 */
ipcMain.handle('get-all-chats', async () => {
    try {
        const chats = await chatDB.getAllChats();
        return { success: true, chats };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

/**
 * Delete a chat session
 */
ipcMain.handle('delete-chat', async (event, chatId) => {
    try {
        await chatDB.deleteChat(chatId);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

/**
 * Get current active chat ID
 */
ipcMain.handle('get-current-chat-id', async () => {
    return { success: true, chatId: chatDB.currentChatId };
});

/**
 * Reload configuration
 */
ipcMain.handle('reload-config', async () => {
    try {
        config.reload();
        return { success: true, message: 'Configuration reloaded successfully' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// ============================================================================
// App Lifecycle
// ============================================================================

/**
 * Initialize default chat when app starts
 */
const initializeDefaultChat = async () => {
    try {
        const chats = await chatDB.getAllChats();
        if (chats.length === 0) {
            // Create first chat if none exist
            const chatId = await chatDB.createNewChat('Welcome Chat');
            chatDB.setCurrentChat(chatId);
        } else {
            // Load most recent chat
            chatDB.setCurrentChat(chats[0].id);
        }
    } catch (error) {
        console.error('Error initializing default chat:', error);
    }
};

// Start application
app.whenReady().then(() => {
    createWindow();
    initializeDefaultChat();
    setupGlobalShortcuts();
});

/**
 * Setup global keyboard shortcuts
 */
function setupGlobalShortcuts() {
    const { globalShortcut } = require('electron');
    
    // Register Ctrl+Shift+Space to show window from anywhere
    try {
        globalShortcut.register('CommandOrControl+Shift+Space', () => {
            if (mainWindow && !mainWindow.isVisible()) {
                mainWindow.show();
                mainWindow.focus();
            }
        });
        console.log('Global shortcut registered: Ctrl+Shift+Space');
    } catch (error) {
        console.error('Failed to register global shortcut:', error);
    }
}

// Close database on quit
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
