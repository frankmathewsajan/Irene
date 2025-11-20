/**
 * Window Manager - Optimized
 * Handles window creation, visibility, and properties
 */

const { BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let isExpanded = true;
let persistentUserData = { name: '', preferences: '', vibrancy: 'appearance-based' };

function getVibrancyFromStorage() { return 'appearance-based'; }
function setVibrancyInStorage(v) { persistentUserData.vibrancy = v; }
function getUserData() { return persistentUserData; }

function createWindow() {
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

    mainWindow = new BrowserWindow({
        width: 900, height: 700, center: true, frame: false, transparent: true,
        alwaysOnTop: true, resizable: true, skipTaskbar: true, show: false,
        title: 'Irene', titleBarStyle: 'hidden', backgroundColor: 'rgba(0, 0, 0, 0)',
        fullscreenable: false, visibleOnAllWorkspaces: true, focusable: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, '..', '..', 'preload.js')
        }
    });

    mainWindow.setContentProtection(true);
    
    if (process.platform === 'darwin') {
        mainWindow.setAlwaysOnTop(true, 'floating', 1);
    } else if (process.platform === 'win32') {
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
    }

    try { mainWindow.setVibrancy(getVibrancyFromStorage()); } catch (e) {}

    mainWindow.loadFile(path.join(__dirname, '..', '..', 'index.html'));
    mainWindow.once('ready-to-show', () => { mainWindow.show(); });
}

function setupGlobalShortcuts() {
    const { globalShortcut } = require('electron');
    
    try {
        globalShortcut.register('CommandOrControl+Shift+Space', () => {
            if (mainWindow) {
                if (mainWindow.isVisible()) {
                    mainWindow.hide();
                } else {
                    mainWindow.show();
                    mainWindow.focus();
                    if (process.platform === 'darwin') {
                        mainWindow.setAlwaysOnTop(true, 'floating', 1);
                    } else if (process.platform === 'win32') {
                        mainWindow.setAlwaysOnTop(true, 'screen-saver');
                    }
                }
            }
        });
        console.log('Global shortcut: Ctrl+Shift+Space');
    } catch (e) {
        console.error('Shortcut registration failed:', e);
    }
}

// IPC Handlers
ipcMain.handle('set-user-data', (e, data) => {
    persistentUserData = { ...persistentUserData, ...data };
    return persistentUserData;
});

ipcMain.handle('get-user-data', () => persistentUserData);

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

ipcMain.handle('show-window', () => {
    if (!mainWindow.isVisible()) {
        mainWindow.show();
        mainWindow.focus();
        isExpanded = true;
    }
    return isExpanded;
});

ipcMain.handle('set-ignore-mouse', (e, ignore) => {
    mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
    return ignore;
});

ipcMain.handle('set-transparency', (e, level) => {
    mainWindow.setOpacity(level);
    return level;
});

ipcMain.handle('set-always-on-top', (e, alwaysOnTop) => {
    mainWindow.setAlwaysOnTop(alwaysOnTop);
    return alwaysOnTop;
});

ipcMain.handle('set-content-protection', (e, isProtected) => {
    mainWindow.setContentProtection(isProtected);
    return isProtected;
});

ipcMain.handle('hide-window', () => {
    mainWindow.hide();
    return true;
});

ipcMain.handle('set-vibrancy', (e, type) => {
    try {
        mainWindow.setVibrancy(type === 'none' ? null : type);
        setVibrancyInStorage(type);
        return { success: true, type };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('trigger-screenshot', async () => {
    try {
        const { screen: electronScreen, desktopCapturer } = require('electron');
        const wasVisible = mainWindow.isVisible();
        
        if (wasVisible) mainWindow.hide();
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: electronScreen.getPrimaryDisplay().size
        });
        
        if (sources.length > 0) {
            const screenshot = sources[0].thumbnail.toDataURL();
            if (wasVisible) mainWindow.show();
            return { success: true, screenshot };
        }
        
        if (wasVisible) mainWindow.show();
        return { success: false, error: 'No screen sources found' };
    } catch (error) {
        if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
            mainWindow.show();
        }
        return { success: false, error: error.message };
    }
});

module.exports = {
    createWindow,
    setupGlobalShortcuts,
    getUserData,
    getMainWindow: () => mainWindow
};
