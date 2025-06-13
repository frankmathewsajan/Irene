const config = require('./config');

class FineTuneConfig {
    constructor() {
        this.config = {};
        this.loadConfig();
    }

    loadConfig() {
        try {
            // Load configuration from config.js module
            this.config = { ...config };
            console.log('Configuration loaded successfully from config.js');
        } catch (error) {
            console.error('Error loading config.js:', error.message);
            // Set default values if file doesn't exist
            this.setDefaults();
        }
    }setDefaults() {
        this.config = {
            GEMINI_API_KEY: 'YOUR_GEMINI_API_KEY',
            SYSTEM_PROMPT_BEFORE: "You are BuzzleBee, a magical fairy assistant. Be helpful and friendly.",
            CONTEXT_AFTER: "Please respond as BuzzleBee the fairy assistant.",
            MAX_RESPONSE_LENGTH: "500",
            FALLBACK_RESPONSE: "Oh my! Something magical went wrong! ✨ Please try again! 🧚‍♀️",
            AI_TEMPERATURE: "0.7",
            AI_TOP_P: "0.8",
            AI_TOP_K: "40",
            COMMAND_OUTPUT_PARSER_PROMPT: "You are BuzzleBee, a magical assistant. Please explain this command output in a friendly way.",
            CONVERSATION_SUMMARY_PROMPT: "Please summarize the conversation so far concisely."
        };
    }

    getApiKey() {
        return this.config.GEMINI_API_KEY;
    }

    getAiSettings() {
        return {
            temperature: parseFloat(this.config.AI_TEMPERATURE) || 0.7,
            topP: parseFloat(this.config.AI_TOP_P) || 0.8,
            topK: parseInt(this.config.AI_TOP_K) || 40
        };
    }    formatMessage(userMessage) {
        const systemPrompt = this.config.SYSTEM_PROMPT_BEFORE || '';
        const contextAfter = this.config.CONTEXT_AFTER || '';
        
        console.log('System prompt length:', systemPrompt.length);
        console.log('Context after length:', contextAfter.length);
        console.log('User message:', userMessage);
        
        // Combine system prompt, user message, and context
        let fullMessage = '';
        
        if (systemPrompt) {
            fullMessage += systemPrompt + '\n\n';
        }
        
        fullMessage += `User: ${userMessage}`;
        
        if (contextAfter) {
            fullMessage += '\n\n' + contextAfter;
        }
        
        console.log('Final message length:', fullMessage.length);
        return fullMessage;
    }

    getMaxResponseLength() {
        return parseInt(this.config.MAX_RESPONSE_LENGTH) || 500;
    }

    getFallbackResponse() {
        return this.config.FALLBACK_RESPONSE || "I'm having trouble right now. Please try again! ✨";
    }

    getPersonalityTraits() {
        return this.config.PERSONALITY_TRAITS ? 
               this.config.PERSONALITY_TRAITS.split(',').map(trait => trait.trim()) : 
               ['helpful', 'friendly', 'magical'];
    }

    getCommandOutputParserPrompt() {
        return this.config.COMMAND_OUTPUT_PARSER_PROMPT || "You are BuzzleBee, a magical assistant. Please explain this command output in a friendly way.";
    }

    getConversationSummaryPrompt() {
        return this.config.CONVERSATION_SUMMARY_PROMPT || "Please summarize the conversation so far concisely.";
    }

    reload() {
        this.loadConfig();
        console.log('Fine-tune configuration reloaded');
    }
}

module.exports = FineTuneConfig;
