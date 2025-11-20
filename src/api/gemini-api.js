/**
 * Gemini API Client - Optimized
 * Handles all communication with Google's Gemini AI API
 */

const https = require('https');

class GeminiAPI {
    constructor(config) {
        this.config = config;
        this.modelOrder = [
            'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro',
            'gemini-2.0-flash-lite', 'gemini-2.0-flash', 'gemini-2.0-flash-exp'
        ];
        this.multimodal = new Set([
            'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash',
            'gemini-2.0-flash-lite', 'gemini-2.5-pro', 'gemini-2.0-flash-exp'
        ]);
        this.currentModelIndex = 0;
        this.lastQuotaError = null;
        this.manualModel = null;
    }

    getNextModel() {
        this.currentModelIndex = (this.currentModelIndex + 1) % this.modelOrder.length;
        return this.modelOrder[this.currentModelIndex];
    }

    getCurrentModel() { return this.modelOrder[this.currentModelIndex]; }
    isMultimodalModel(model) { return this.multimodal.has(model); }
    getActiveModel() { return this.manualModel || this.getCurrentModel(); }

    setModel(modelName) {
        const idx = this.modelOrder.indexOf(modelName);
        if (idx !== -1) {
            this.currentModelIndex = idx;
        } else {
            this.manualModel = modelName;
        }
        console.log(`📌 Model set: ${modelName}`);
        return true;
    }

    async generateContent(message, images = []) {
        const apiKey = this.config.getApiKey();
        
        if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') {
            throw new Error('Invalid API key. Please configure in config.js');
        }

        const aiSettings = this.config.getAiSettings();
        const parts = [];
        
        // Process images
        if (images?.length > 0) {
            console.log(`📸 Processing ${images.length} image(s)`);
            images.forEach((img, i) => {
                const match = img.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
                if (match) {
                    parts.push({ inlineData: { mimeType: `image/${match[1]}`, data: match[2] } });
                    console.log(`✅ Image ${i + 1}: ${match[1]}, ${match[2].length} chars`);
                } else {
                    console.log(`❌ Image ${i + 1}: Parse failed`);
                }
            });
        }
        
        parts.push({ text: message });
        console.log(`📦 Parts: ${parts.length} (${parts.filter(p => p.inlineData).length} img, ${parts.filter(p => p.text).length} txt)`);
        
        const requestBody = {
            contents: [{ parts }],
            generationConfig: {
                maxOutputTokens: 2048,
                temperature: aiSettings.temperature,
                topP: aiSettings.topP,
                topK: aiSettings.topK
            }
        };

        // Switch to multimodal model for images
        if (images?.length > 0 && this.getActiveModel().includes('2.0')) {
            console.log('🎨 Images detected, switching to 2.5 model');
            this.currentModelIndex = 0;
            this.manualModel = null;
        }

        // Retry with fallback models
        let attempts = 0, usedManual = false;
        while (attempts < this.modelOrder.length) {
            try {
                const result = await this._makeRequest(apiKey, requestBody);
                if (this.manualModel && usedManual) this.manualModel = null;
                return result;
            } catch (error) {
                if (error.message.includes('quota')) {
                    console.log(`⚠️ Model ${this.getActiveModel()} quota exceeded`);
                    this.lastQuotaError = error;
                    
                    if (this.manualModel) {
                        console.log('🔄 Manual model failed, auto-rotation');
                        this.manualModel = null;
                        usedManual = true;
                    }
                    
                    this.getNextModel();
                    attempts++;
                    
                    if (attempts >= this.modelOrder.length) {
                        throw new Error('All models exceeded quota. Try again later.');
                    }
                } else {
                    throw error;
                }
            }
        }
    }

    _makeRequest(apiKey, requestBody) {
        return new Promise((resolve, reject) => {
            const data = JSON.stringify(requestBody);
            const model = this.getActiveModel();
            
            const options = {
                hostname: 'generativelanguage.googleapis.com',
                path: `/v1beta/models/${model}:generateContent?key=${apiKey}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data, 'utf8')
                }
            };
            
            console.log(`🤖 Using: ${model}`);

            const req = https.request(options, (res) => {
                let responseData = '';
                res.on('data', (chunk) => { responseData += chunk; });
                res.on('end', () => {
                    try {
                        const json = JSON.parse(responseData);
                        if (json.error) {
                            reject(new Error(`Gemini API Error: ${json.error.message}`));
                            return;
                        }

                        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (!text) {
                            reject(new Error('No text in API response'));
                            return;
                        }

                        const maxLen = this.config.getMaxResponseLength();
                        const trimmed = text.length > maxLen ? text.substring(0, maxLen - 3) + '...' : text;
                        resolve({ text: trimmed, tokenUsage: json.usageMetadata || {} });
                    } catch (error) {
                        reject(new Error('Parse failed: ' + error.message));
                    }
                });
            });

            req.on('error', (err) => { reject(new Error('Request failed: ' + err.message)); });
            req.write(data);
            req.end();
        });
    }

    async generateSummary(history) {
        let text = 'Conversation to summarize:\n\n';
        history.forEach(m => {
            if (m.role !== 'system') {
                text += `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}\n\n`;
            }
        });
        const result = await this.generateContent(this.config.getConversationSummaryPrompt() + '\n\n' + text);
        return typeof result === 'string' ? result : result.text;
    }

    async generateTitle(messages) {
        let text = 'First messages:\n\n';
        messages.forEach(m => {
            text += `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}\n\n`;
        });
        const prompt = `Generate a short title (2-6 words) for this conversation. Only the title:\n\n${text}`;
        const result = await this.generateContent(prompt);
        return (typeof result === 'string' ? result : result.text).trim().replace(/^["']|["']$/g, '').substring(0, 50);
    }

    async parseCommandOutput(cmdInfo, result) {
        const maxLen = result.success ? 2000 : 1000;
        const output = result.success ? result.output : (result.error || result.stderr || 'Unknown error');
        const truncated = output.length > maxLen ? output.substring(0, maxLen) + '\n... (truncated)' : output;

        const prompt = result.success
            ? `I executed: "${cmdInfo.command}"\n\nOutput:\n\`\`\`\n${truncated}\n\`\`\`\n\nExplain in friendly way:\n1. What it did\n2. What results show\n3. Important info\n4. Any concerns\n\nAs Irene! ✨🧚‍♀️`
            : `I tried: "${cmdInfo.command}"\n\nError:\n\`\`\`\n${truncated}\n\`\`\`\n\nExplain:\n1. What error means\n2. Why it happened\n3. Solutions\n\nAs Irene! ✨🧚‍♀️`;

        const apiResult = await this.generateContent(prompt);
        return typeof apiResult === 'string' ? apiResult : apiResult.text;
    }
}

module.exports = GeminiAPI;
