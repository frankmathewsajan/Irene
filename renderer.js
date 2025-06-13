class BuzzleBeeApp {
    constructor() {
        this.isExpanded = false;
        this.parser = new ResponseParser();
        this.initializeElements();
        this.bindEvents();
        this.setupChat();
    }    initializeElements() {
        this.fairyMode = document.getElementById('fairy-mode');
        this.chatMode = document.getElementById('chat-mode');
        this.fairyImg = document.getElementById('fairy-img');
        this.minimizeBtn = document.getElementById('minimize-btn');
        this.newChatBtn = document.getElementById('new-chat-btn');
        this.chatInput = document.getElementById('chat-input');
        this.chatMessages = document.getElementById('chat-messages');
    }    bindEvents() {
        // Fairy click to expand
        this.fairyImg.addEventListener('click', () => this.toggleWindow());
        
        // Minimize button
        this.minimizeBtn.addEventListener('click', () => this.toggleWindow());
        
        // New Chat button
        this.newChatBtn.addEventListener('click', () => this.createNewChat());
        
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
    }    addMessage(text, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        const textSpan = document.createElement('span');
        textSpan.className = 'message-text';
        textSpan.textContent = text;
        
        contentDiv.appendChild(textSpan);
        messageDiv.appendChild(contentDiv);
        
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        
        return messageDiv;
    }

    addBotMessage(text) {
        return this.addMessage(text, 'bot');
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
        // Add some initial sparkle to the interface
        setTimeout(() => {
            if (this.isExpanded) {
                this.chatInput.focus();
            }
        }, 100);
    }    async handleBotResponse(response) {
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
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new BuzzleBeeApp();
});