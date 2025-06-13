const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');
const FineTuneConfig = require('./finetune-config');
const ChatHistoryDB = require('./database');

let mainWindow;
let isExpanded = false;
let config;
let chatDB;

// Initialize unified configuration and database
config = new FineTuneConfig();
chatDB = new ChatHistoryDB();

// Function to call Gemini API
async function callGeminiAPI(userMessage) {
    return new Promise((resolve, reject) => {
        console.log('=== GEMINI API CALL START ===');
        console.log('Input user message:', JSON.stringify(userMessage));
          // Use the full configuration for intention classification
        const formattedMessage = config.formatMessage(userMessage);
        const aiSettings = config.getAiSettings();
        
        console.log('Formatted message:', JSON.stringify(formattedMessage));
        console.log('Message length:', formattedMessage.length);
        
        const GEMINI_API_KEY = config.getApiKey();
        console.log('API Key present:', GEMINI_API_KEY ? 'YES' : 'NO');
        console.log('API Key length:', GEMINI_API_KEY ? GEMINI_API_KEY.length : 0);
        
        const requestBody = {
            contents: [
                {
                    parts: [
                        {
                            text: formattedMessage
                        }
                    ]
                }
            ],
            generationConfig: {
                maxOutputTokens: Math.floor(config.getMaxResponseLength() / 4),
                temperature: aiSettings.temperature,
                topP: aiSettings.topP,
                topK: aiSettings.topK
            }
        };
        
        let data;
        try {
            data = JSON.stringify(requestBody);
            console.log('JSON stringify successful');
            console.log('Request payload size (bytes):', Buffer.byteLength(data, 'utf8'));
            console.log('Request payload preview:', data.substring(0, 200) + '...');
        } catch (jsonError) {
            console.error('❌ JSON stringify error:', jsonError);
            reject(new Error('Failed to create request payload: ' + jsonError.message));
            return;
        }

        const options = {
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data, 'utf8')
            }
        };
        
        console.log('Request options:', {
            hostname: options.hostname,
            path: options.path.substring(0, 80) + '...', // Don't log full API key
            method: options.method,
            headers: options.headers
        });const req = https.request(options, (res) => {
            let responseData = '';
              console.log(`API Response Status: ${res.statusCode}`);
            console.log(`API Response Headers:`, res.headers);
            
            res.on('data', (chunk) => {
                responseData += chunk;
                console.log(`Received chunk: ${chunk.length} bytes`);
            });

            res.on('end', () => {
                console.log('=== RESPONSE PROCESSING ===');
                console.log(`Total response size: ${responseData.length} bytes`);
                console.log(`Raw response:`, responseData);
                
                try {
                    const jsonResponse = JSON.parse(responseData);
                    console.log('JSON parse successful');
                      // Check for API error response
                    if (jsonResponse.error) {
                        console.log('API returned error:', jsonResponse.error);
                        reject(new Error(`Gemini API Error: ${jsonResponse.error.message || JSON.stringify(jsonResponse.error)}`));
                        return;
                    }
                    
                    console.log('Checking response structure...');
                    console.log('Has candidates:', !!jsonResponse.candidates);
                    console.log('Candidates length:', jsonResponse.candidates ? jsonResponse.candidates.length : 0);
                    
                    if (jsonResponse.candidates && jsonResponse.candidates[0]) {
                        console.log('Has first candidate:', true);
                        console.log('First candidate:', jsonResponse.candidates[0]);
                        
                        if (jsonResponse.candidates[0].content) {
                            console.log('Has content:', true);
                            console.log('Content:', jsonResponse.candidates[0].content);
                            
                            if (jsonResponse.candidates[0].content.parts && jsonResponse.candidates[0].content.parts[0]) {
                                let text = jsonResponse.candidates[0].content.parts[0].text;
                                console.log('Successfully extracted text:', text.substring(0, 100) + '...');
                                
                                // Trim response if it exceeds max length
                                const maxLength = config.getMaxResponseLength();
                                if (text.length > maxLength) {
                                    console.log(`Trimming response from ${text.length} to ${maxLength} characters`);
                                    text = text.substring(0, maxLength - 3) + '...';
                                }
                                
                                console.log('=== API CALL SUCCESS ===');
                                resolve(text);
                            } else {
                                console.log('No text found in content parts');
                                console.log('Content parts:', jsonResponse.candidates[0].content.parts);
                                reject(new Error('No text found in API response'));
                            }
                        } else {
                            console.log('No content found in first candidate');
                            reject(new Error('No content found in API response'));
                        }
                    } else {
                        console.log('No candidates found in response');
                        console.log('Response structure:', Object.keys(jsonResponse));
                        reject(new Error('No candidates found in API response'));
                    }
                } catch (parseError) {
                    console.log('JSON parse failed');
                    console.log('Parse error:', parseError.message);
                    console.log('Raw response that failed to parse:', responseData);
                    reject(new Error('Failed to parse API response: ' + parseError.message));
                }
            });        });        req.on('error', (error) => {
            console.log('=== REQUEST ERROR ===');
            console.log('Request failed:', error.message);
            console.log('Error code:', error.code);
            console.log('Error stack:', error.stack);
            reject(new Error('API request failed: ' + error.message));
        });

        console.log('Sending request...');
        req.write(data);
        req.end();
        console.log('Request sent');
        console.log('=== WAITING FOR RESPONSE ===');
    });
}

function createWindow() {
    // Get the primary display's work area
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    
    // Initial fairy window size and position (top-right corner)
    const fairySize = 120;
    const margin = 20;
      mainWindow = new BrowserWindow({
        width: fairySize,
        height: fairySize,
        x: screenWidth - fairySize - margin,
        y: margin,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false,
        skipTaskbar: true,
        title: '',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile('index.html');

    // Optional: Open DevTools in development
    // mainWindow.webContents.openDevTools();
}

// Handle window expansion toggle
ipcMain.handle('toggle-window', () => {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    const margin = 20;
    
    if (!isExpanded) {
        // Expand to chat window
        const chatWidth = 350;
        const chatHeight = 500;
        
        mainWindow.setBounds({
            width: chatWidth,
            height: chatHeight,
            x: screenWidth - chatWidth - margin,
            y: margin
        });
        isExpanded = true;
    } else {
        // Collapse back to fairy
        const fairySize = 120;
        
        mainWindow.setBounds({
            width: fairySize,
            height: fairySize,
            x: screenWidth - fairySize - margin,
            y: margin
        });
        isExpanded = false;
    }
      return isExpanded;
});

// Handle Gemini API calls
ipcMain.handle('call-gemini-api', async (event, message) => {
    console.log('\n=== IPC API CALL RECEIVED ===');
    console.log('Message from renderer:', JSON.stringify(message));
    
    try {
        const apiKey = config.getApiKey();
        console.log('API Key check - Present:', apiKey ? 'YES' : 'NO');
        console.log('API Key check - Length:', apiKey ? apiKey.length : 0);
        
        if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') {
            console.log('Invalid API key detected');
            throw new Error('Please set your Gemini API key in config.js file');
        }
        
        // Save user message to database
        if (chatDB.currentChatId) {
            await chatDB.addMessage('user', message);
        }
        
        // Get chat history for context
        const history = await chatDB.getChatHistory(10); // Last 10 messages
        const contextFromHistory = chatDB.formatHistoryForContext(history);
        
        // Add context to message if available
        const messageWithContext = message + contextFromHistory;
        
        console.log('API key valid, calling Gemini API...');
        const response = await callGeminiAPI(messageWithContext);
        console.log('API call successful, response length:', response.length);
        
        // Save assistant response to database
        if (chatDB.currentChatId) {
            await chatDB.addMessage('assistant', response);
        }
        
        return { success: true, response };
    } catch (error) {
        console.log('=== API CALL FAILED ===');
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
        
        // Use fallback response from configuration
        const fallbackResponse = config.getFallbackResponse();
        console.log('Using fallback response:', fallbackResponse);
        
        // Save fallback response to database
        if (chatDB.currentChatId) {
            await chatDB.addMessage('assistant', fallbackResponse + ' (fallback)');
        }
        
        return { success: true, response: fallbackResponse, isFallback: true };
    }
});

// Handle system command execution
ipcMain.handle('execute-command', async (event, command) => {
    console.log('\n=== SYSTEM COMMAND EXECUTION ===');
    console.log('Command received:', JSON.stringify(command));
    
    return new Promise((resolve) => {
        // Safety check - basic command validation
        const sanitizedCommand = command.trim();
        
        if (!sanitizedCommand) {
            console.log('Empty command rejected');
            resolve({ success: false, error: 'Empty command' });
            return;
        }
        
        // Log the execution attempt
        console.log('Executing command:', sanitizedCommand);
        console.log('Command length:', sanitizedCommand.length);
        
        // Execute the command with timeout
        const execOptions = {
            timeout: 30000, // 30 second timeout
            maxBuffer: 1024 * 1024, // 1MB max buffer
            encoding: 'utf8'
        };
        
        exec(sanitizedCommand, execOptions, (error, stdout, stderr) => {
            console.log('=== COMMAND EXECUTION COMPLETE ===');
            
            if (error) {
                console.log('Command failed with error:', error.message);
                console.log('Error code:', error.code);
                console.log('Error signal:', error.signal);
                
                // Include stderr in error message if available
                const errorMessage = stderr ? `${error.message}\n\nError output:\n${stderr}` : error.message;
                
                resolve({ 
                    success: false, 
                    error: errorMessage,
                    exitCode: error.code
                });
            } else {
                console.log('Command executed successfully');
                console.log('Stdout length:', stdout ? stdout.length : 0);
                console.log('Stderr length:', stderr ? stderr.length : 0);
                
                // Combine stdout and stderr for complete output
                let output = '';
                if (stdout) output += stdout;
                if (stderr) {
                    if (output) output += '\n--- Warnings/Info ---\n';
                    output += stderr;
                }
                
                resolve({ 
                    success: true, 
                    output: output || '(Command completed with no output)',
                    hasStderr: !!stderr
                });
            }
        });
    });
});

// Handle configuration reload
ipcMain.handle('reload-config', async () => {
    try {
        config.reload();
        return { success: true, message: 'Configuration reloaded successfully' };
    } catch (error) {
        console.error('Error reloading config:', error);
        return { success: false, error: error.message };
    }
});

// Chat management IPC handlers
ipcMain.handle('create-new-chat', async (event, title) => {
    try {
        const chatId = await chatDB.createNewChat(title);
        chatDB.setCurrentChat(chatId);
        return { success: true, chatId };
    } catch (error) {
        console.error('Error creating new chat:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('load-chat', async (event, chatId) => {
    try {
        chatDB.setCurrentChat(chatId);
        const history = await chatDB.getChatHistory(50); // Load more for display
        return { success: true, history };
    } catch (error) {
        console.error('Error loading chat:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-all-chats', async () => {
    try {
        const chats = await chatDB.getAllChats();
        return { success: true, chats };
    } catch (error) {
        console.error('Error getting all chats:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('delete-chat', async (event, chatId) => {
    try {
        await chatDB.deleteChat(chatId);
        return { success: true };
    } catch (error) {
        console.error('Error deleting chat:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-current-chat-id', async () => {
    return { success: true, chatId: chatDB.currentChatId };
});

// Initialize with a default chat when app starts
const initializeDefaultChat = async () => {
    try {
        const chats = await chatDB.getAllChats();
        if (chats.length === 0) {
            // Create first chat if none exist
            const chatId = await chatDB.createNewChat('Welcome Chat');
            chatDB.setCurrentChat(chatId);
            console.log('Created default chat with ID:', chatId);
        } else {
            // Load the most recent chat
            chatDB.setCurrentChat(chats[0].id);
            console.log('Loaded most recent chat with ID:', chats[0].id);
        }
    } catch (error) {
        console.error('Error initializing default chat:', error);
    }
};

app.whenReady().then(() => {
    createWindow();
    initializeDefaultChat();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});