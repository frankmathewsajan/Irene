/**
 * Gemini API Client
 * Handles all communication with Google's Gemini AI API
 */

const https = require('https');

class GeminiAPI {
    constructor(config) {
        this.config = config;
        // Fallback order when quota exceeded (prioritize models with available quota)
        this.modelOrder = [
            'gemini-2.5-flash',              // Primary: 1/10 RPM, 1.43K/250K TPM, 2/250 RPD
            'gemini-2.5-flash-lite',         // Secondary: 1/15 RPM, 1.3K/250K TPM, 4/1K RPD
            'gemini-2.5-flash-live',         // Live API: Unlimited (0/Unlimited)
            'gemini-2.0-flash-live',         // Live API: Unlimited (0/Unlimited)
            'gemini-2.0-flash-lite',         // Backup: 0/30 RPM (unused quota)
            'gemini-2.0-flash',              // Fallback: 0/15 RPM (unused quota)
            'gemini-2.5-pro',                // High quality: 0/2 RPM (unused quota)
            'gemma-3-27b',                   // Gemma: 0/30 RPM (unused quota)
            'gemma-3-12b',                   // Gemma: 0/30 RPM (unused quota)
            'gemini-1.5-flash',              // Stable: Available
            'gemini-1.5-pro'                 // Last resort: Stable pro model
        ];
        this.currentModelIndex = 0;
        this.lastQuotaError = null;
        this.manualModel = null; // Track if user manually selected a model
    }

    /**
     * Get next available model in rotation
     */
    getNextModel() {
        this.currentModelIndex = (this.currentModelIndex + 1) % this.modelOrder.length;
        return this.modelOrder[this.currentModelIndex];
    }

    /**
     * Get current model
     */
    getCurrentModel() {
        return this.modelOrder[this.currentModelIndex];
    }

    /**
     * Check if model supports multimodal (images/audio)
     */
    isMultimodalModel(model) {
        const multimodalModels = [
            'gemini-2.5-flash',
            'gemini-2.5-flash-lite',
            'gemini-2.0-flash',
            'gemini-2.0-flash-lite',
            'gemini-2.5-pro',
            'gemini-2.0-flash-exp'
        ];
        return multimodalModels.includes(model);
    }

    /**
     * Set specific model (overrides rotation)
     */
    setModel(modelName) {
        // Check if model is in fallback order, if not add it temporarily
        const index = this.modelOrder.indexOf(modelName);
        if (index !== -1) {
            this.currentModelIndex = index;
        } else {
            // User selected a model not in default rotation, use it directly
            this.manualModel = modelName;
        }
        console.log(`📌 Model manually set to: ${modelName}`);
        return true;
    }

    /**
     * Get the model to use (manual override or current in rotation)
     */
    getActiveModel() {
        return this.manualModel || this.getCurrentModel();
    }

    /**
     * Send a message to Gemini API and get response
     * @param {string} message - The formatted message to send
     * @param {Array<string>} images - Array of base64 data URLs of images
     * @returns {Promise<string>} - AI response text
     */
    async generateContent(message, images = []) {
        const apiKey = this.config.getApiKey();
        
        // Validate API key
        if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') {
            throw new Error('Invalid API key. Please configure in config.js');
        }

        // Prepare request body
        const aiSettings = this.config.getAiSettings();
        
        // Build parts array with text and images
        const parts = [];
        
        // Add images first (if any)
        if (images && images.length > 0) {
            for (const imageDataUrl of images) {
                // Extract base64 data from data URL
                const matches = imageDataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
                if (matches) {
                    const mimeType = `image/${matches[1]}`;
                    const base64Data = matches[2];
                    
                    parts.push({
                        inlineData: {
                            mimeType: mimeType,
                            data: base64Data
                        }
                    });
                }
            }
        }
        
        // Add text message
        parts.push({ text: message });
        
        const requestBody = {
            contents: [{
                parts: parts
            }],
            generationConfig: {
                maxOutputTokens: 2048,
                temperature: aiSettings.temperature,
                topP: aiSettings.topP,
                topK: aiSettings.topK
            }
        };

        // Auto-switch to multimodal model if images present
        const needsMultimodal = images && images.length > 0;
        if (needsMultimodal && !this.isMultimodalModel(this.getCurrentModel())) {
            console.log('🎨 Images detected, ensuring multimodal model...');
            // Already using multimodal models by default, but log it
        }

        // Try current model, fallback to next on quota error
        let attempts = 0;
        const maxAttempts = this.modelOrder.length;
        
        while (attempts < maxAttempts) {
            try {
                return await this._makeRequest(apiKey, requestBody);
            } catch (error) {
                // Check if it's a quota error
                if (error.message.includes('quota') || error.message.includes('Quota exceeded')) {
                    console.log(`⚠️ Model ${this.getCurrentModel()} quota exceeded, trying next model...`);
                    this.lastQuotaError = error;
                    this.getNextModel(); // Rotate to next model
                    attempts++;
                    
                    if (attempts >= maxAttempts) {
                        throw new Error('All models exceeded quota. Please try again later.');
                    }
                    // Continue to next attempt
                } else {
                    // Non-quota error, throw immediately
                    throw error;
                }
            }
        }
    }

    /**
     * Make HTTPS request to Gemini API
     * @private
     */
    _makeRequest(apiKey, requestBody) {
        return new Promise((resolve, reject) => {
            const data = JSON.stringify(requestBody);
            const currentModel = this.getActiveModel();
            
            const options = {
                hostname: 'generativelanguage.googleapis.com',
                path: `/v1beta/models/${currentModel}:generateContent?key=${apiKey}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data, 'utf8')
                }
            };
            
            console.log(`🤖 Using model: ${currentModel}`);

            const req = https.request(options, (res) => {
                let responseData = '';

                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    try {
                        const jsonResponse = JSON.parse(responseData);

                        // Check for API error
                        if (jsonResponse.error) {
                            reject(new Error(`Gemini API Error: ${jsonResponse.error.message}`));
                            return;
                        }

                        // Extract text from response
                        const text = jsonResponse.candidates?.[0]?.content?.parts?.[0]?.text;
                        
                        if (!text) {
                            reject(new Error('No text found in API response'));
                            return;
                        }

                        // Extract token usage
                        const tokenUsage = jsonResponse.usageMetadata || {};

                        // Trim if needed
                        const maxLength = this.config.getMaxResponseLength();
                        const trimmedText = text.length > maxLength 
                            ? text.substring(0, maxLength - 3) + '...'
                            : text;

                        resolve({ text: trimmedText, tokenUsage });
                    } catch (error) {
                        reject(new Error('Failed to parse API response: ' + error.message));
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error('API request failed: ' + error.message));
            });

            req.write(data);
            req.end();
        });
    }

    /**
     * Generate a conversation summary
     * @param {Array} history - Chat history messages
     * @returns {Promise<string>} - Summary text
     */
    async generateSummary(history) {
        let conversationText = 'Conversation to summarize:\n\n';
        
        for (const message of history) {
            if (message.role === 'system') continue;
            const roleLabel = message.role === 'user' ? 'User' : 'Assistant';
            conversationText += `${roleLabel}: ${message.content}\n\n`;
        }

        const prompt = this.config.getConversationSummaryPrompt() + '\n\n' + conversationText;
        const result = await this.generateContent(prompt);
        return typeof result === 'string' ? result : result.text;
    }

    /**
     * Generate a chat title from first messages
     * @param {Array} messages - First few messages
     * @returns {Promise<string>} - Generated title
     */
    async generateTitle(messages) {
        let conversationText = 'First messages of a conversation:\n\n';
        
        for (const message of messages) {
            const roleLabel = message.role === 'user' ? 'User' : 'Assistant';
            conversationText += `${roleLabel}: ${message.content}\n\n`;
        }

        const prompt = `Generate a short, descriptive title (2-6 words) for this conversation. Only respond with the title, nothing else.\n\n${conversationText}`;
        const result = await this.generateContent(prompt);
        const response = typeof result === 'string' ? result : result.text;
        
        // Clean up title
        return response.trim().replace(/^["']|["']$/g, '').substring(0, 50);
    }

    /**
     * Parse command output with AI assistance
     * @param {Object} commandInfo - Command information
     * @param {Object} result - Execution result
     * @returns {Promise<string>} - Human-readable explanation
     */
    async parseCommandOutput(commandInfo, result) {
        let prompt;

        if (result.success && result.output) {
            // Truncate long outputs
            const maxLength = 2000;
            const output = result.output.length > maxLength 
                ? result.output.substring(0, maxLength) + '\n... (output truncated)'
                : result.output;

            prompt = `I executed this system command: "${commandInfo.command}"

The command completed successfully with the following output:
\`\`\`
${output}
\`\`\`

Please analyze this output and explain what it means in a friendly, human-readable way. Focus on:
1. What the command did
2. What the results show
3. Any important information or patterns in the output
4. Whether everything looks normal or if there are any concerns

Respond as Irene in a magical, helpful way! ✨🧚‍♀️`;
        } else {
            // Handle errors
            const errorText = result.error || result.stderr || 'Unknown error occurred';
            const maxLength = 1000;
            const error = errorText.length > maxLength
                ? errorText.substring(0, maxLength) + '\n... (error truncated)'
                : errorText;

            prompt = `I tried to execute this system command: "${commandInfo.command}"

But it failed with this error:
\`\`\`
${error}
\`\`\`

Please explain what went wrong in a friendly, human-readable way. Help me understand:
1. What this error means
2. Why it might have happened  
3. Possible solutions or next steps

Respond as Irene in a magical, helpful way! ✨🧚‍♀️`;
        }

        const apiResult = await this.generateContent(prompt);
        return typeof apiResult === 'string' ? apiResult : apiResult.text;
    }
}

module.exports = GeminiAPI;
