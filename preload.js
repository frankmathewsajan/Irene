const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    toggleWindow: () => ipcRenderer.invoke('toggle-window'),
    sendMessage: (message) => ipcRenderer.invoke('call-gemini-api', message),
    executeCommand: (command) => ipcRenderer.invoke('execute-command', command),
    reloadConfig: () => ipcRenderer.invoke('reload-config'),
    
    // Chat management functions
    createNewChat: (title) => ipcRenderer.invoke('create-new-chat', title),
    loadChat: (chatId) => ipcRenderer.invoke('load-chat', chatId),
    getAllChats: () => ipcRenderer.invoke('get-all-chats'),
    deleteChat: (chatId) => ipcRenderer.invoke('delete-chat', chatId),
    getCurrentChatId: () => ipcRenderer.invoke('get-current-chat-id')
});