/**
 * Irene AR Overlay - UI Controller
 * Manages the Iron Man-style HUD interface
 */

class IreneARApp {
    constructor() {
        this.parser = new ResponseParser();
        this.markdownFormatter = new MarkdownFormatter();
        this.pendingScreenshots = [];
        this.initializeElements();
        this.bindEvents();
        this.setupChat();
        this.initializeVibrancy();
        this.restoreCustomizePanelState();
    }

    // ========================================================================
    // Initialization
    // ========================================================================

    initializeElements() {
        // Chat elements
        this.chatMessages = document.getElementById('chat-messages');
        this.chatInput = document.getElementById('chat-input');
        this.sendBtn = document.getElementById('send-btn');
        
        // Navigation buttons
        this.newChatBtn = document.getElementById('new-chat-btn');
        this.prevChatsBtn = document.getElementById('prev-chats-btn');
        this.closePrevChatsBtn = document.getElementById('close-prev-chats');
        this.voiceBtn = document.getElementById('voice-btn');
        this.screenshotBtn = document.getElementById('screenshot-btn');
        this.hideBtn = document.getElementById('hide-btn');
        
        // Panels
        this.prevChatsPanel = document.getElementById('prev-chats-panel');
        this.prevChatsList = document.getElementById('prev-chats-list');
        
        // Customization controls
        this.opacitySlider = document.getElementById('opacity-slider');
        this.opacityValue = document.getElementById('opacity-value');
        this.alwaysOnTopToggle = document.getElementById('always-on-top-toggle');
        this.contentProtectionToggle = document.getElementById('content-protection-toggle');
        this.modelSelect = document.getElementById('model-select');
        this.themeButtons = document.querySelectorAll('.theme-btn');
        
        // Toggle customize button
        this.toggleCustomizeBtn = document.getElementById('toggle-customize-btn');
        this.leftPanel = document.querySelector('.left-panel');
        this.hudContainer = document.getElementById('ar-hud');
    }

    bindEvents() {
        // Send message
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Hide window (ESC key)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                window.electronAPI.toggleWindow();
            }
        });

        // Screenshot button
        if (this.screenshotBtn) {
            this.screenshotBtn.addEventListener('click', () => this.takeScreenshot());
        }

        // Hide button
        if (this.hideBtn) {
            this.hideBtn.addEventListener('click', () => this.hideWindow());
        }

        // Toggle customize panel
        if (this.toggleCustomizeBtn) {
            this.toggleCustomizeBtn.addEventListener('click', () => this.toggleCustomizePanel());
        }

        // New chat
        if (this.newChatBtn) {
            this.newChatBtn.addEventListener('click', () => this.createNewChat());
        }

        // Chat history
        if (this.prevChatsBtn) {
            this.prevChatsBtn.addEventListener('click', () => this.togglePrevChats());
        }
        
        if (this.closePrevChatsBtn) {
            this.closePrevChatsBtn.addEventListener('click', () => this.closePrevChats());
        }

        // Customization controls
        if (this.opacitySlider) {
            this.opacitySlider.addEventListener('input', (e) => this.updateOpacity(e));
        }
        
        if (this.alwaysOnTopToggle) {
            this.alwaysOnTopToggle.addEventListener('change', (e) => this.toggleAlwaysOnTop(e));
        }
        
        if (this.contentProtectionToggle) {
            this.contentProtectionToggle.addEventListener('change', (e) => this.toggleContentProtection(e));
        }
        
        if (this.modelSelect) {
            this.modelSelect.addEventListener('change', (e) => this.changeModel(e));
        }
        
        if (this.themeButtons && this.themeButtons.length > 0) {
            this.themeButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const theme = btn.getAttribute('data-theme');
                    this.changeTheme(theme);
                });
            });
        }
        
        // Load saved theme
        this.loadSavedTheme();

        // Click-through: Enable passthrough on empty areas
        document.body.addEventListener('mouseenter', (e) => {
            if (e.target === document.body) {
                window.electronAPI.setIgnoreMouse(true);
            }
        });

        document.addEventListener('mouseover', (e) => {
            const isOverPanel = e.target.closest('.glass-panel, .command-bar');
            window.electronAPI.setIgnoreMouse(!isOverPanel);
        });
    }

    // ========================================================================
    // Screenshot Functionality
    // ========================================================================

    async takeScreenshot() {
        try {
            const result = await window.electronAPI.triggerScreenshot();
            
            if (result.success && result.screenshot) {
                this.pendingScreenshots.push(result.screenshot);
                this.showScreenshotPreview(result.screenshot, this.pendingScreenshots.length - 1);
            }
        } catch (error) {
            // Handle error silently
        }
    }

    hideWindow() {
        window.electronAPI.hideWindow();
    }

    toggleCustomizePanel() {
        if (!this.leftPanel || !this.hudContainer) return;
        
        const isHidden = this.leftPanel.classList.contains('hidden');
        
        if (isHidden) {
            // Show customize panel
            this.leftPanel.classList.remove('hidden');
            this.hudContainer.classList.remove('customize-hidden');
            if (this.toggleCustomizeBtn) {
                this.toggleCustomizeBtn.style.transform = 'rotate(0deg)';
            }
            localStorage.setItem('customizePanelVisible', 'true');
        } else {
            // Hide customize panel
            this.leftPanel.classList.add('hidden');
            this.hudContainer.classList.add('customize-hidden');
            if (this.toggleCustomizeBtn) {
                this.toggleCustomizeBtn.style.transform = 'rotate(180deg)';
            }
            localStorage.setItem('customizePanelVisible', 'false');
        }
    }

    showScreenshotPreview(dataUrl, index) {
        // Find or create preview container
        let container = this.chatInput.parentElement.querySelector('.screenshot-previews');
        if (!container) {
            container = document.createElement('div');
            container.className = 'screenshot-previews';
            this.chatInput.parentElement.insertBefore(container, this.chatInput.parentElement.firstChild);
        }

        // Create preview element
        const preview = document.createElement('div');
        preview.className = 'screenshot-preview';
        preview.dataset.index = index;
        preview.innerHTML = `
            <img src="${dataUrl}" alt="Screenshot ${index + 1}">
            <button class="remove-screenshot" title="Remove screenshot">
                <i class="fas fa-times"></i>
            </button>
        `;

        container.appendChild(preview);

        // Add remove handler
        preview.querySelector('.remove-screenshot').addEventListener('click', () => {
            this.pendingScreenshots.splice(index, 1);
            preview.remove();
            
            // Remove container if empty
            if (container.children.length === 0) {
                container.remove();
            }
            
            // Update indices
            Array.from(container.children).forEach((child, i) => {
                child.dataset.index = i;
            });
        });
    }

    // ========================================================================
    // Vibrancy Initialization (One-time, appearance-based)
    // ========================================================================

    async initializeVibrancy() {
        // Always use appearance-based vibrancy
        await window.electronAPI.setVibrancy('appearance-based');
    }

    restoreCustomizePanelState() {
        const isVisible = localStorage.getItem('customizePanelVisible');
        // Default to visible if not set
        if (isVisible === 'false') {
            this.leftPanel.classList.add('hidden');
            this.hudContainer.classList.add('customize-hidden');
            if (this.toggleCustomizeBtn) {
                this.toggleCustomizeBtn.style.transform = 'rotate(180deg)';
            }
        }
    }

    // ========================================================================
    // Chat Functionality
    // ========================================================================

    async setupChat() {
        await this.loadChatHistory();
    }

    async sendMessage() {
        const message = this.chatInput.value.trim();
        if (!message) return;

        // Clear welcome message if present
        const welcomeMsg = this.chatMessages.querySelector('.welcome-message');
        if (welcomeMsg) welcomeMsg.remove();

        // Add user message with screenshots if present
        let screenshots = [];
        if (this.pendingScreenshots.length > 0) {
            screenshots = [...this.pendingScreenshots];
            console.log(`📸 Sending ${screenshots.length} screenshot(s) with message`);
            console.log('Screenshot data lengths:', screenshots.map(s => s.length));
            
            // Display first screenshot in message
            this.addMessage(message, 'user', screenshots[0]);
            
            // Remove preview container
            const previewContainer = document.querySelector('.screenshot-previews');
            if (previewContainer) previewContainer.remove();
            
            // Clear pending screenshots
            this.pendingScreenshots = [];
        } else {
            console.log('📝 Sending message without screenshots');
            this.addMessage(message, 'user');
        }
        this.chatInput.value = '';

        // Show typing indicator
        const typingId = this.addTypingIndicator();

        try {
            // Get selected model
            const selectedModel = this.modelSelect ? this.modelSelect.value : null;
            const result = await window.electronAPI.sendMessage(message, screenshots, selectedModel);
            this.removeTypingIndicator(typingId);

            if (result.success) {
                await this.handleBotResponse(result.response, result.tokenUsage);
            } else {
                this.addBotMessage('Sorry, I\'m having trouble connecting right now. Please try again later.');
            }
        } catch (error) {
            this.removeTypingIndicator(typingId);
            this.addBotMessage('An error occurred. Please try again.');
            console.error('Send message error:', error);
        }
    }

    addMessage(text, type, useMarkdown = false, screenshot = null, tokenUsage = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;
        
        // Add screenshot if present (only show first one in message)
        if (screenshot) {
            const screenshotImg = document.createElement('img');
            screenshotImg.src = screenshot;
            screenshotImg.className = 'message-screenshot';
            messageDiv.appendChild(screenshotImg);
        }
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        if (useMarkdown && type === 'bot') {
            contentDiv.innerHTML = this.markdownFormatter.toHTML(text);
        } else {
            contentDiv.textContent = text;
        }
        
        messageDiv.appendChild(contentDiv);
        
        // Add token usage metadata for bot messages
        if (type === 'bot' && tokenUsage) {
            const metaDiv = document.createElement('div');
            metaDiv.className = 'message-metadata';
            metaDiv.innerHTML = `
                <span title="Prompt tokens">📥 ${tokenUsage.promptTokenCount || 0}</span>
                <span title="Response tokens">📤 ${tokenUsage.candidatesTokenCount || 0}</span>
                <span title="Total tokens">💾 ${tokenUsage.totalTokenCount || 0}</span>
            `;
            messageDiv.appendChild(metaDiv);
        }
        
        // Add copy button for bot messages
        if (type === 'bot') {
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-message-btn';
            copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
            copyBtn.title = 'Copy response';
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(text).then(() => {
                    copyBtn.innerHTML = '<i class="fas fa-check"></i>';
                    setTimeout(() => {
                        copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
                    }, 2000);
                });
            };
            messageDiv.appendChild(copyBtn);
        }
        
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        
        return messageDiv;
    }

    addBotMessage(text, tokenUsage = null) {
        this.addMessage(text, 'bot', true, null, tokenUsage);
    }

    addTypingIndicator() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message bot-message typing-indicator';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        const dotsDiv = document.createElement('div');
        dotsDiv.className = 'typing-dots';
        dotsDiv.innerHTML = '<span></span><span></span><span></span>';
        
        contentDiv.appendChild(dotsDiv);
        messageDiv.appendChild(contentDiv);
        
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        
        return messageDiv;
    }

    removeTypingIndicator(typingElement) {
        if (typingElement && typingElement.parentNode) {
            typingElement.parentNode.removeChild(typingElement);
        }
    }

    async handleBotResponse(response) {
        const parsed = this.parser.parseResponse(response);
        
        if (parsed.type === 'system_command') {
            const cleanText = this.parser.cleanResponseText(response);
            if (cleanText) this.addBotMessage(cleanText);
            
            const windowsCommand = this.parser.convertToWindowsCommand(parsed.command.command);
            this.showCommandWithRunButton({
                ...parsed.command,
                command: windowsCommand
            });
        } else {
            this.addBotMessage(response);
        }
    }

    showCommandWithRunButton(commandInfo) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message bot-message command-message';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        const commandContainer = document.createElement('div');
        commandContainer.className = 'command-container';
        
        commandContainer.innerHTML = `
            <div class="command-title">System Command</div>
            <div class="command-code">${this.escapeHtml(commandInfo.command)}</div>
            <button class="run-command-btn">▶ Execute Command</button>
        `;
        
        const runBtn = commandContainer.querySelector('.run-command-btn');
        runBtn.onclick = () => this.executeCommand(commandInfo, messageDiv);
        
        contentDiv.appendChild(commandContainer);
        messageDiv.appendChild(contentDiv);
        
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    async executeCommand(commandInfo, messageDiv) {
        const runBtn = messageDiv.querySelector('.run-command-btn');
        runBtn.textContent = '⏳ Executing...';
        runBtn.disabled = true;

        try {
            const result = await window.electronAPI.executeCommand(commandInfo.command);
            
            if (result.success) {
                runBtn.textContent = '✅ Done';
                this.addBotMessage(`Command executed successfully!\n\nOutput:\n\`\`\`\n${result.output}\n\`\`\``);
            } else {
                runBtn.textContent = '❌ Failed';
                this.addBotMessage(`Command failed:\n\n\`\`\`\n${result.error}\n\`\`\``);
            }
        } catch (error) {
            runBtn.textContent = '❌ Error';
            this.addBotMessage(`Error executing command: ${error.message}`);
        }

        setTimeout(() => {
            runBtn.disabled = false;
            runBtn.textContent = '▶ Execute Command';
        }, 3000);
    }

    // ========================================================================
    // Chat Management
    // ========================================================================

    async createNewChat() {
        try {
            const result = await window.electronAPI.createNewChat();
            
            if (result.success) {
                this.chatMessages.innerHTML = `
                    <div class="welcome-message">
                        <i class="fas fa-sparkles"></i>
                        <h2>How can I help you?</h2>
                        <p>New conversation started ✨</p>
                    </div>
                `;
                this.chatInput.focus();
            }
        } catch (error) {
            console.error('Error creating new chat:', error);
        }
    }

    async loadChatHistory() {
        try {
            const currentChatResult = await window.electronAPI.getCurrentChatId();
            
            if (currentChatResult.success && currentChatResult.chatId) {
                const result = await window.electronAPI.loadChat(currentChatResult.chatId);
                
                if (result.success && result.history && result.history.length > 0) {
                    this.chatMessages.innerHTML = '';
                    for (const message of result.history) {
                        if (message.role === 'user') {
                            this.addMessage(message.content, 'user');
                        } else if (message.role === 'assistant') {
                            this.addBotMessage(message.content);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error loading chat history:', error);
        }
    }

    // ========================================================================
    // Chat History Panel
    // ========================================================================

    async togglePrevChats() {
        const isOpen = this.prevChatsPanel.classList.contains('open');
        
        if (isOpen) {
            this.closePrevChats();
        } else {
            await this.openPrevChats();
        }
    }

    async openPrevChats() {
        try {
            const result = await window.electronAPI.getAllChats();
            
            if (result.success) {
                this.displayChatsList(result.chats);
            }
            
            this.prevChatsPanel.classList.add('open');
        } catch (error) {
            console.error('Error loading chats:', error);
        }
    }

    closePrevChats() {
        this.prevChatsPanel.classList.remove('open');
    }

    displayChatsList(chats) {
        this.prevChatsList.innerHTML = '';

        if (chats.length === 0) {
            this.prevChatsList.innerHTML = '<div class="empty-chats">No previous chats yet</div>';
            return;
        }

        chats.forEach((chat) => {
            const chatItem = this.createChatItem(chat);
            this.prevChatsList.appendChild(chatItem);
        });
    }

    createChatItem(chat) {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';

        const date = new Date(chat.created_at);
        const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        const title = chat.title || `Chat #${chat.id}`;

        chatItem.innerHTML = `
            <div class="chat-item-title">${title}</div>
            <div class="chat-item-date">${formattedDate}</div>
        `;

        chatItem.addEventListener('click', () => this.loadSelectedChat(chat.id));

        return chatItem;
    }

    async loadSelectedChat(chatId) {
        try {
            const result = await window.electronAPI.loadChat(chatId);
            
            if (result.success) {
                this.closePrevChats();
                this.chatMessages.innerHTML = '';
                
                if (result.history && result.history.length > 0) {
                    for (const message of result.history) {
                        if (message.role === 'user') {
                            this.addMessage(message.content, 'user');
                        } else if (message.role === 'assistant') {
                            this.addBotMessage(message.content);
                        }
                    }
                }
                
                this.chatInput.focus();
            }
        } catch (error) {
            console.error('Error loading selected chat:', error);
        }
    }

    // ========================================================================
    // Customization Controls
    // ========================================================================

    updateOpacity(e) {
        const value = parseInt(e.target.value);
        if (this.opacityValue) {
            this.opacityValue.textContent = value;
        }
        const opacity = value / 100;
        window.electronAPI.setTransparency(opacity);
    }

    toggleAlwaysOnTop(e) {
        const alwaysOnTop = e.target.checked;
        window.electronAPI.setAlwaysOnTop(alwaysOnTop);
    }

    toggleContentProtection(e) {
        const isProtected = e.target.checked;
        window.electronAPI.setContentProtection(isProtected);
    }

    changeModel(e) {
        const model = e.target.value;
        localStorage.setItem('selectedModel', model);
    }

    changeTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('selectedTheme', theme);
        
        // Update active button
        if (this.themeButtons && this.themeButtons.length > 0) {
            this.themeButtons.forEach(btn => {
                const btnTheme = btn.getAttribute('data-theme');
                const isActive = btnTheme === theme;
                btn.classList.toggle('active', isActive);
            });
        }
    }

    loadSavedTheme() {
        const savedTheme = localStorage.getItem('selectedTheme') || 'cyber-blue';
        const savedModel = localStorage.getItem('selectedModel') || 'gemini-2.5-flash';
        
        document.body.setAttribute('data-theme', savedTheme);
        if (this.modelSelect) this.modelSelect.value = savedModel;
        
        if (this.themeButtons && this.themeButtons.length > 0) {
            this.themeButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.theme === savedTheme);
            });
        }
    }

    // ========================================================================
    // Utilities
    // ========================================================================

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the AR overlay app
function initializeApp() {
    const app = new IreneARApp();
    window.ireneApp = app;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
