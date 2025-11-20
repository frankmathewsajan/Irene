const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    toggleWindow: () => ipcRenderer.invoke('toggle-window'),
    showWindow: () => ipcRenderer.invoke('show-window'),
    hideWindow: () => ipcRenderer.invoke('hide-window'),
    setIgnoreMouse: (ignore) => ipcRenderer.invoke('set-ignore-mouse', ignore),
    setTransparency: (level) => ipcRenderer.invoke('set-transparency', level),
    setAlwaysOnTop: (alwaysOnTop) => ipcRenderer.invoke('set-always-on-top', alwaysOnTop),
    setContentProtection: (isProtected) => ipcRenderer.invoke('set-content-protection', isProtected),
    setVibrancy: (type) => ipcRenderer.invoke('set-vibrancy', type),
    triggerScreenshot: () => ipcRenderer.invoke('trigger-screenshot'),
    sendMessage: (message, images = [], selectedModel = null) => ipcRenderer.invoke('call-gemini-api', message, images, selectedModel),
    executeCommand: (command) => ipcRenderer.invoke('execute-command', command),
    reloadConfig: () => ipcRenderer.invoke('reload-config'),
    
    // Chat management functions
    createNewChat: (title) => ipcRenderer.invoke('create-new-chat', title),
    loadChat: (chatId) => ipcRenderer.invoke('load-chat', chatId),
    getAllChats: () => ipcRenderer.invoke('get-all-chats'),
    deleteChat: (chatId) => ipcRenderer.invoke('delete-chat', chatId),
    getCurrentChatId: () => ipcRenderer.invoke('get-current-chat-id'),
    
    // Persistent user data
    setUserData: (data) => ipcRenderer.invoke('set-user-data', data),
    getUserData: () => ipcRenderer.invoke('get-user-data')
});