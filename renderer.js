class BuzzleBeeApp {
    constructor() {
        this.isExpanded = false;
        this.parser = new ResponseParser();
        this.markdownFormatter = new MarkdownFormatter();
        this.initializeElements();
        this.bindEvents();
        this.setupChat();
    }    initializeElements() {
        this.fairyMode = document.getElementById('fairy-mode');
        this.chatMode = document.getElementById('chat-mode');
        this.fairyImg = document.getElementById('fairy-img');
        this.minimizeBtn = document.getElementById('minimize-btn');
        this.newChatBtn = document.getElementById('new-chat-btn');
        this.prevChatsBtn = document.getElementById('prev-chats-btn');
        this.prevChatsPanel = document.getElementById('prev-chats-panel');
        this.closePrevChatsBtn = document.getElementById('close-prev-chats');
        this.prevChatsList = document.getElementById('prev-chats-list');
        this.chatInput = document.getElementById('chat-input');
        this.chatMessages = document.getElementById('chat-messages');
    }    bindEvents() {
        // Fairy click to expand
        this.fairyImg.addEventListener('click', () => this.toggleWindow());
        
        // Minimize button
        this.minimizeBtn.addEventListener('click', () => this.toggleWindow());
        
        // New Chat button
        this.newChatBtn.addEventListener('click', () => this.createNewChat());
        
        // Previous Chats button
        if (this.prevChatsBtn) {
            this.prevChatsBtn.addEventListener('click', () => {
                console.log('Previous chats button clicked');
                this.togglePrevChats();
            });
        } else {
            console.error('Previous chats button not found!');
        }
        
        // Close Previous Chats button
        if (this.closePrevChatsBtn) {
            this.closePrevChatsBtn.addEventListener('click', () => this.closePrevChats());
        } else {
            console.error('Close previous chats button not found!');
        }
        
        // Send message on Enter key
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });
    }

    async toggleWindow() {
        try {
            this.isExpanded = await window.electronAPI.toggleWindow();
            this.switchMode();
        } catch (error) {
            console.error('Failed to toggle window:', error);
        }
    }

    switchMode() {
        if (this.isExpanded) {
            this.fairyMode.classList.remove('active');
            this.chatMode.classList.add('active');
            // Focus on input when chat opens
            setTimeout(() => {
                this.chatInput.focus();
            }, 300);
        } else {
            this.chatMode.classList.remove('active');
            this.fairyMode.classList.add('active');
        }
    }    async sendMessage() {
        const message = this.chatInput.value.trim();
        if (!message) return;

        // Add user message
        this.addMessage(message, 'user');
        this.chatInput.value = '';

        // Show typing indicator
        const typingId = this.addTypingIndicator();        try {
            // Call Gemini API
            const result = await window.electronAPI.sendMessage(message);
            
            // Remove typing indicator
            this.removeTypingIndicator(typingId);            if (result.success) {
                if (result.isFallback) {
                    // Add a subtle indicator for fallback responses
                    this.addBotMessage(result.response + ' (offline mode)');
                } else {
                    // Parse response for system commands using the new parser
                    await this.handleBotResponse(result.response);
                }
            } else {
                this.addBotMessage('Sorry, I\'m having trouble connecting right now. Please try again later. ✨');
            }
        } catch (error) {
            // Remove typing indicator
            this.removeTypingIndicator(typingId);
            this.addBotMessage('Sorry, I\'m having trouble connecting right now. Please try again later.');
            console.error('API Error:', error);
        }
    }    addMessage(text, type, useMarkdown = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        const textElement = document.createElement('div');
        textElement.className = 'message-text';
        
        if (useMarkdown && type === 'bot') {
            // Use markdown formatting for bot messages
            textElement.innerHTML = this.markdownFormatter.toHTML(text);
        } else {
            // Plain text for user messages or non-markdown content
            textElement.textContent = text;
        }
        
        contentDiv.appendChild(textElement);
        messageDiv.appendChild(contentDiv);
        
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        
        return messageDiv;
    }

    addBotMessage(text) {
        // Always use markdown formatting for bot messages
        return this.addMessage(text, 'bot', true);
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
    }    setupChat() {
        // Load existing chat history
        this.loadChatHistory();
        
        // Add some initial sparkle to the interface
        setTimeout(() => {
            if (this.isExpanded) {
                this.chatInput.focus();
            }
        }, 100);
    }async handleBotResponse(response) {
        console.log('Handling bot response with new parser...');
        
        // Use the parser to analyze the response
        const parsed = this.parser.parseResponse(response);
        
        if (parsed.type === 'system_command') {
            console.log('System command detected:', parsed.command);
            
            // Display the clean response text (without code blocks)
            const cleanText = this.parser.cleanResponseText(response);
            if (cleanText) {
                this.addBotMessage(cleanText);
            }
            
            // Convert Unix commands to Windows if needed
            const windowsCommand = this.parser.convertToWindowsCommand(parsed.command.command);
            
            // Show the command with a run button
            this.showCommandWithRunButton({
                ...parsed.command,
                command: windowsCommand
            });
        } else {
            // Regular chat response
            this.addBotMessage(response);
        }
    }    showCommandWithRunButton(commandInfo) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message bot-message command-message';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        // Command info
        const commandContainer = document.createElement('div');
        commandContainer.className = 'command-container';
        
        const commandTitle = document.createElement('div');
        commandTitle.className = 'command-title';
        commandTitle.textContent = 'System Command:';
        
        const commandDescription = document.createElement('div');
        commandDescription.className = 'command-description';
        commandDescription.textContent = commandInfo.description;
        
        // Danger level indicator
        const levelContainer = document.createElement('div');
        levelContainer.className = 'command-level';
        const level = commandInfo.level || 'MEDIUM';
        levelContainer.innerHTML = `<span class="level-label">Danger Level:</span> <span class="level-value level-${level.toLowerCase()}">${level}</span>`;
        
        const commandCode = document.createElement('pre');
        commandCode.className = 'command-code';
        commandCode.textContent = commandInfo.command;
        
        const runButton = document.createElement('button');
        runButton.className = 'run-command-btn';
        runButton.textContent = '▶ Run Command';
        runButton.onclick = () => this.executeCommandFromButton(commandInfo, messageDiv);
        
        // Add warning for high-danger commands
        if (level === 'HIGH') {
            const warningDiv = document.createElement('div');
            warningDiv.className = 'command-warning';
            warningDiv.innerHTML = '⚠️ <strong>Warning:</strong> This command has a HIGH danger level. Please review carefully before executing.';
            
            commandContainer.appendChild(commandTitle);
            commandContainer.appendChild(commandDescription);
            commandContainer.appendChild(levelContainer);
            commandContainer.appendChild(warningDiv);
            commandContainer.appendChild(commandCode);
            commandContainer.appendChild(runButton);
        } else {
            commandContainer.appendChild(commandTitle);
            commandContainer.appendChild(commandDescription);
            commandContainer.appendChild(levelContainer);
            commandContainer.appendChild(commandCode);
            commandContainer.appendChild(runButton);
        }
        
        contentDiv.appendChild(commandContainer);
        messageDiv.appendChild(contentDiv);
        
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }    async executeCommandFromButton(commandInfo, commandMessageDiv) {
        console.log('Executing command from button:', commandInfo.command);
        
        // Disable the button and show executing state
        const runButton = commandMessageDiv.querySelector('.run-command-btn');
        const originalText = runButton.textContent;
        runButton.disabled = true;
        runButton.textContent = '⏳ Executing...';
        runButton.className = 'run-command-btn executing';
        
        try {
            // Execute command via IPC
            const result = await window.electronAPI.executeCommand(commandInfo.command);
            
            // Update button state first
            if (result.success) {
                runButton.textContent = '🔄 Processing...';
                runButton.className = 'run-command-btn processing';
                
                // Send output to Gemini for human-readable parsing
                await this.processCommandOutputWithGemini(commandInfo, result);
                
                runButton.textContent = '✅ Completed';
                runButton.className = 'run-command-btn completed';
            } else {
                // For failed commands, still try to parse the error output
                await this.processCommandOutputWithGemini(commandInfo, result);
                
                runButton.textContent = '❌ Failed';
                runButton.className = 'run-command-btn failed';
            }
        } catch (error) {
            console.error('Command execution error:', error);
            const errorResult = {
                success: false,
                error: 'Failed to execute command: ' + error.message
            };
            
            await this.processCommandOutputWithGemini(commandInfo, errorResult);
            
            runButton.textContent = '❌ Failed';
            runButton.className = 'run-command-btn failed';
        }
        
        // Re-enable button after a delay
        setTimeout(() => {
            runButton.disabled = false;
            runButton.textContent = originalText;
            runButton.className = 'run-command-btn';
        }, 3000);
    }

    addCommandExecutionResult(commandInfo, result) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message bot-message command-result ${result.success ? 'success' : 'error'}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        // Result header
        const headerDiv = document.createElement('div');
        headerDiv.className = 'result-header';
        headerDiv.innerHTML = `
            <div class="result-title">${result.success ? '✅ Command Executed Successfully' : '❌ Command Failed'}</div>
            <div class="result-command-name">${this.escapeHtml(commandInfo.command)}</div>
        `;
        
        // Output
        const outputDiv = document.createElement('div');
        outputDiv.className = 'result-output';
        
        if (result.success && result.output) {
            const pre = document.createElement('pre');
            pre.className = 'command-output';
            pre.textContent = result.output;
            outputDiv.appendChild(pre);
        } else if (!result.success && result.error) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-output';
            errorDiv.textContent = result.error;
            outputDiv.appendChild(errorDiv);
        } else {
            outputDiv.innerHTML = '<em>No output</em>';
        }
        
        contentDiv.appendChild(headerDiv);
        contentDiv.appendChild(outputDiv);
        messageDiv.appendChild(contentDiv);
        
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    async showCommandPermissionPrompt(command, description) {
        const promptDiv = document.createElement('div');
        promptDiv.className = 'message bot-message command-prompt';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        // Command details
        const commandInfoDiv = document.createElement('div');
        commandInfoDiv.className = 'command-info';
        commandInfoDiv.innerHTML = `
            <div class="command-title">Command Details:</div>
            <div class="command-text">${this.escapeHtml(command)}</div>
            <div class="command-description">${this.escapeHtml(description)}</div>
        `;
        
        // Permission question
        const questionDiv = document.createElement('div');
        questionDiv.className = 'permission-question';
        questionDiv.textContent = 'Do you want me to execute this command?';
        
        // Buttons container
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'permission-buttons';
        
        const allowBtn = document.createElement('button');
        allowBtn.className = 'permission-btn allow-btn';
        allowBtn.textContent = 'Yes, Execute';
        allowBtn.onclick = () => this.executeCommand(command, description, promptDiv);
        
        const denyBtn = document.createElement('button');
        denyBtn.className = 'permission-btn deny-btn';
        denyBtn.textContent = 'No, Cancel';
        denyBtn.onclick = () => this.cancelCommand(promptDiv);
        
        buttonsDiv.appendChild(allowBtn);
        buttonsDiv.appendChild(denyBtn);
        
        contentDiv.appendChild(commandInfoDiv);
        contentDiv.appendChild(questionDiv);
        contentDiv.appendChild(buttonsDiv);
        promptDiv.appendChild(contentDiv);
        
        this.chatMessages.appendChild(promptDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    async executeCommand(command, description, promptDiv) {
        // Replace the permission prompt with execution status
        promptDiv.innerHTML = `
            <div class="message-content">
                <div class="command-executing">
                    <div class="executing-text">Executing: ${this.escapeHtml(description)}</div>
                    <div class="executing-dots">
                        <span></span><span></span><span></span>
                    </div>
                </div>
            </div>
        `;

        try {
            // Execute command via IPC
            const result = await window.electronAPI.executeCommand(command);
            
            // Show result
            if (result.success) {
                this.addCommandResult(command, description, result.output, false);
            } else {
                this.addCommandResult(command, description, result.error, true);
            }
        } catch (error) {
            console.error('Command execution error:', error);
            this.addCommandResult(command, description, 'Failed to execute command: ' + error.message, true);
        }

        // Remove the executing prompt
        if (promptDiv.parentNode) {
            promptDiv.parentNode.removeChild(promptDiv);
        }
    }

    cancelCommand(promptDiv) {
        // Replace the permission prompt with cancellation message
        promptDiv.innerHTML = `
            <div class="message-content">
                <div class="command-cancelled">
                    <span class="cancelled-text">Command execution cancelled by user</span>
                </div>
            </div>
        `;
        
        // Remove the prompt after a short delay
        setTimeout(() => {
            if (promptDiv.parentNode) {
                promptDiv.parentNode.removeChild(promptDiv);
            }
        }, 2000);
    }

    addCommandResult(command, description, output, isError) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message bot-message command-result ${isError ? 'error' : 'success'}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        // Result header
        const headerDiv = document.createElement('div');
        headerDiv.className = 'result-header';
        headerDiv.innerHTML = `
            <div class="result-title">${isError ? '❌ Command Failed' : '✅ Command Executed'}</div>
            <div class="result-command">${this.escapeHtml(command)}</div>
        `;
        
        // Output
        const outputDiv = document.createElement('div');
        outputDiv.className = 'result-output';
        
        if (output.trim()) {
            const pre = document.createElement('pre');
            pre.textContent = output;
            outputDiv.appendChild(pre);
        } else {
            outputDiv.innerHTML = '<em>No output</em>';
        }
        
        contentDiv.appendChild(headerDiv);
        contentDiv.appendChild(outputDiv);
        messageDiv.appendChild(contentDiv);
        
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }    async processCommandOutputWithGemini(commandInfo, result) {
        console.log('Processing command output with Gemini...');
        
        // Add a temporary "processing" message
        const processingMessage = this.addBotMessage('🔄 Let me analyze that command output for you... ✨');
        
        try {
            // Prepare the prompt for Gemini to parse the command output
            let promptMessage;
            
            if (result.success && result.output) {
                // Truncate very long outputs to avoid API limits
                const maxOutputLength = 2000;
                let output = result.output;
                if (output.length > maxOutputLength) {
                    output = output.substring(0, maxOutputLength) + '\n... (output truncated)';
                }
                
                promptMessage = `I executed this system command: "${commandInfo.command}"

The command completed successfully with the following output:
\`\`\`
${output}
\`\`\`

Please analyze this output and explain what it means in a friendly, human-readable way. Focus on:
1. What the command did
2. What the results show
3. Any important information or patterns in the output
4. Whether everything looks normal or if there are any concerns

Respond as BuzzleBee in a magical, helpful way! ✨🧚‍♀️`;
            } else {
                const errorText = result.error || result.stderr || 'Unknown error occurred';
                // Truncate long error messages too
                const maxErrorLength = 1000;
                let error = errorText;
                if (error.length > maxErrorLength) {
                    error = error.substring(0, maxErrorLength) + '\n... (error truncated)';
                }
                
                promptMessage = `I tried to execute this system command: "${commandInfo.command}"

But it failed with this error:
\`\`\`
${error}
\`\`\`

Please explain what went wrong in a friendly, human-readable way. Help me understand:
1. What this error means
2. Why it might have happened  
3. Possible solutions or next steps

Respond as BuzzleBee in a magical, helpful way! ✨🧚‍♀️`;
            }
            
            // Send to Gemini for parsing
            console.log('Sending output to Gemini for parsing...');
            const geminiResponse = await window.electronAPI.sendMessage(promptMessage);
            
            // Remove the processing message
            processingMessage.remove();
            
            if (geminiResponse.success) {
                // Display the parsed response as a regular chat message
                this.addBotMessage(geminiResponse.response);
            } else {
                console.error('Failed to get Gemini response:', geminiResponse.error);
                // Fallback to original display method
                this.addCommandExecutionResult(commandInfo, result);
            }
            
        } catch (error) {
            console.error('Error processing output with Gemini:', error);
            // Remove the processing message
            processingMessage.remove();
            // Fallback to original display method
            this.addCommandExecutionResult(commandInfo, result);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async createNewChat() {
        try {
            console.log('Creating new chat...');
            const result = await window.electronAPI.createNewChat();
            
            if (result.success) {
                console.log('New chat created with ID:', result.chatId);
                
                // Clear current chat display
                this.chatMessages.innerHTML = '';
                
                // Add welcome message for new chat
                this.addBotMessage('Hello! I\'m BuzzleBee, your magical assistant! ✨ This is a fresh new conversation. How can I help you today?');
                
                // Focus on input
                this.chatInput.focus();
            } else {
                console.error('Failed to create new chat:', result.error);
                this.addBotMessage('Sorry, I couldn\'t start a new chat right now. Please try again! ✨');
            }
        } catch (error) {
            console.error('Error creating new chat:', error);
            this.addBotMessage('Oops! Something magical went wrong while starting a new chat. ✨');
        }
    }    async loadChatHistory() {
        try {
            console.log('Loading chat history...');
            const currentChatResult = await window.electronAPI.getCurrentChatId();
            
            if (currentChatResult.success && currentChatResult.chatId) {
                const result = await window.electronAPI.loadChat(currentChatResult.chatId);
                
                if (result.success && result.history) {
                    console.log(`Loaded ${result.history.length} messages from history`);
                    
                    // Clear current messages (including any existing welcome message)
                    this.chatMessages.innerHTML = '';
                    
                    // Display history messages
                    for (const message of result.history) {
                        if (message.role === 'user') {
                            this.addMessage(message.content, 'user');
                        } else if (message.role === 'assistant') {
                            this.addBotMessage(message.content);
                        }
                        // Skip system messages (commands) for now in display
                    }
                    
                    // If no history, add welcome message
                    if (result.history.length === 0) {
                        this.addBotMessage('Hello! I\'m BuzzleBee, your magical assistant! ✨');
                    }
                } else {
                    console.log('No chat history to load or error:', result.error);
                    // Clear any existing messages and add welcome message
                    this.chatMessages.innerHTML = '';
                    this.addBotMessage('Hello! I\'m BuzzleBee, your magical assistant! ✨');
                }
            } else {
                console.log('No current chat ID available');
                // Clear any existing messages and add welcome message
                this.chatMessages.innerHTML = '';
                this.addBotMessage('Hello! I\'m BuzzleBee, your magical assistant! ✨');
            }
        } catch (error) {
            console.error('Error loading chat history:', error);
            // Clear any existing messages and add welcome message on error
            this.chatMessages.innerHTML = '';
            this.addBotMessage('Hello! I\'m BuzzleBee, your magical assistant! ✨');
        }
    }

    displayChatHistory(history) {
        this.clearChatMessages();
        
        if (history.length === 0) {
            // Add welcome message for empty chat
            this.addBotMessage("Hello! I'm BuzzleBee, your magical assistant! ✨");
            return;
        }

        // Display all messages from history
        history.forEach(message => {
            if (message.role === 'user') {
                this.addMessage(message.content, 'user');
            } else if (message.role === 'assistant') {
                this.addBotMessage(message.content);
            }
        });
    }    // Previous Chats functionality
    async togglePrevChats() {
        console.log('togglePrevChats called');
        const isOpen = this.prevChatsPanel.classList.contains('open');
        console.log('Panel is currently open:', isOpen);
        
        if (isOpen) {
            this.closePrevChats();
        } else {
            await this.openPrevChats();
        }
    }    async openPrevChats() {
        console.log('openPrevChats called');
        try {
            // Load all chats
            console.log('Fetching all chats...');
            const result = await window.electronAPI.getAllChats();
            console.log('Received result:', result);
            
            if (result.success) {
                console.log('Received chats:', result.chats);
                this.displayChatsList(result.chats);
            } else {
                console.error('Failed to get chats:', result.error);
                this.displayChatsList([]);
            }
            
            this.prevChatsPanel.classList.add('open');
            console.log('Panel opened successfully');
        } catch (error) {
            console.error('Error loading chats:', error);
            this.displayChatsList([]);
        }
    }

    closePrevChats() {
        this.prevChatsPanel.classList.remove('open');
    }    displayChatsList(chats) {
        console.log('displayChatsList called with:', chats);
        this.prevChatsList.innerHTML = '';

        if (chats.length === 0) {
            console.log('No chats to display, showing empty message');
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'empty-chats';
            emptyDiv.innerHTML = '<i class="fas fa-comments"></i><br>No previous chats yet';
            this.prevChatsList.appendChild(emptyDiv);
            return;
        }

        console.log('Creating chat items for', chats.length, 'chats');
        chats.forEach((chat, index) => {
            console.log(`Creating chat item ${index}:`, chat);
            const chatItem = this.createChatItem(chat);
            this.prevChatsList.appendChild(chatItem);
        });
        console.log('All chat items created and added');
    }

    createChatItem(chat) {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';

        // Format the date
        const date = new Date(chat.created_at);
        const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        // Get the title (use generated title or fallback to date)
        const title = chat.title && !chat.title.startsWith('Chat ') ? 
                     chat.title : 
                     `Chat from ${formattedDate}`;

        // Get a preview of the conversation (you might want to fetch the last message)
        const preview = chat.message_count > 0 ? 
                       `${chat.message_count} messages` : 
                       'No messages yet';

        chatItem.innerHTML = `
            <div class="chat-item-content">
                <div class="chat-item-title">${title}</div>
                <div class="chat-item-date">${formattedDate}</div>
                <div class="chat-item-preview">${preview}</div>
            </div>
            <div class="chat-item-actions">
                <button class="delete-chat-btn" title="Delete Chat">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        // Add click handler to load the chat
        const content = chatItem.querySelector('.chat-item-content');
        content.addEventListener('click', () => this.loadSelectedChat(chat.id));

        // Add delete handler
        const deleteBtn = chatItem.querySelector('.delete-chat-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent chat loading
            this.deleteSelectedChat(chat.id);
        });

        return chatItem;
    }

    async loadSelectedChat(chatId) {
        try {
            console.log('Loading chat:', chatId);
            const result = await window.electronAPI.loadChat(chatId);
            
            if (result.success) {
                // Close the previous chats panel
                this.closePrevChats();
                
                // Clear current messages and load the selected chat history
                this.chatMessages.innerHTML = '';
                
                if (result.history && result.history.length > 0) {
                    this.displayChatHistory(result.history);
                } else {
                    this.addBotMessage('Hello! I\'m BuzzleBee, your magical assistant! ✨');
                }
                
                // Focus on input
                this.chatInput.focus();
            } else {
                console.error('Failed to load chat:', result.error);
            }
        } catch (error) {
            console.error('Error loading selected chat:', error);
        }
    }

    async deleteSelectedChat(chatId) {
        if (!confirm('Are you sure you want to delete this chat? This action cannot be undone.')) {
            return;
        }

        try {
            console.log('Deleting chat:', chatId);
            const result = await window.electronAPI.deleteChat(chatId);
              if (result.success) {
                // Refresh the chats list
                const chatsResult = await window.electronAPI.getAllChats();
                if (chatsResult.success) {
                    this.displayChatsList(chatsResult.chats);
                }
                
                // If the deleted chat was the current one, create a new chat
                const currentChatId = await window.electronAPI.getCurrentChatId();
                if (currentChatId === chatId) {
                    await this.createNewChat();
                }
            } else {
                console.error('Failed to delete chat:', result.error);
                alert('Failed to delete chat. Please try again.');
            }
        } catch (error) {
            console.error('Error deleting chat:', error);
            alert('Failed to delete chat. Please try again.');
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new BuzzleBeeApp();
});