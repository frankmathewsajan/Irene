/**
 * Irene Response Parser
 * Parses Gemini API responses to extract system commands and other structured data
 */

class ResponseParser {
    constructor() {        this.patterns = {
            // Pattern for code blocks containing system commands
            codeBlock: /```[\s\S]*?```/g,
            // Pattern for JSON-like structured command format within code blocks
            jsonCommand: /\{\s*INTENTION:\s*(.+?)\s*COMMAND:\s*(.+?)\s*DESCRIPTION:\s*(.+?)\s*LEVEL:\s*(.+?)\s*\}/s,
            // Legacy pattern for structured command format within code blocks
            structuredCommand: /INTENTION:\s*(.+?)\s*\nCOMMAND:\s*(.+?)\s*\nDESCRIPTION:\s*(.+?)(?:\n|$)/s,
            // Alternative patterns for different formats
            intentionLine: /INTENTION:\s*(.+)/i,
            commandLine: /COMMAND:\s*(.+)/i,
            descriptionLine: /DESCRIPTION:\s*(.+)/i,
            levelLine: /LEVEL:\s*(.+)/i
        };
    }

    /**
     * Parse a Gemini response to extract system command information
     * @param {string} response - The full response from Gemini
     * @returns {Object} Parsed result with command info or null
     */
    parseResponse(response) {
        console.log('Parsing response:', response.substring(0, 200) + '...');
        
        // First, try to extract code blocks
        const codeBlocks = this.extractCodeBlocks(response);
        
        if (codeBlocks.length > 0) {
            // Check each code block for structured commands
            for (const block of codeBlocks) {
                const command = this.parseCodeBlock(block);
                if (command) {
                    return {
                        type: 'system_command',
                        command: command,
                        originalResponse: response,
                        codeBlock: block
                    };
                }
            }
        }
        
        // Fallback: try to parse the entire response for structured format
        const fallbackCommand = this.parseStructuredFormat(response);
        if (fallbackCommand) {
            return {
                type: 'system_command',
                command: fallbackCommand,
                originalResponse: response,
                codeBlock: null
            };
        }
        
        // No system command found, return as regular chat
        return {
            type: 'chat',
            message: response,
            originalResponse: response
        };
    }

    /**
     * Extract code blocks from response
     * @param {string} response - The response text
     * @returns {Array} Array of code block contents
     */
    extractCodeBlocks(response) {
        const blocks = [];
        const matches = response.match(this.patterns.codeBlock);
        
        if (matches) {
            for (const match of matches) {
                // Remove the ``` markers and get the content
                const content = match.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
                blocks.push(content);
            }
        }
        
        return blocks;
    }

    /**
     * Parse a code block for structured command format
     * @param {string} blockContent - Content of the code block
     * @returns {Object|null} Command object or null
     */    parseCodeBlock(blockContent) {
        // First try the new JSON-like format
        const jsonMatch = blockContent.match(this.patterns.jsonCommand);
        
        if (jsonMatch) {
            const [, intention, command, description, level] = jsonMatch;
            
            // Check if this is actually a system command intention
            if (this.isSystemCommandIntention(intention)) {
                return {
                    intention: intention.trim(),
                    command: this.cleanCommand(command.trim()),
                    description: description.trim(),
                    level: level.trim().toUpperCase()
                };
            }
        }
        
        // Fallback to legacy format
        const legacyMatch = blockContent.match(this.patterns.structuredCommand);
        
        if (legacyMatch) {
            const [, intention, command, description] = legacyMatch;
            
            // Check if this is actually a system command intention
            if (this.isSystemCommandIntention(intention)) {
                return {
                    intention: intention.trim(),
                    command: this.cleanCommand(command.trim()),
                    description: description.trim(),
                    level: 'MEDIUM' // Default level for legacy format
                };
            }
        }
        
        return null;
    }

    /**
     * Parse structured format from raw text (fallback method)
     * @param {string} text - The text to parse
     * @returns {Object|null} Command object or null
     */    parseStructuredFormat(text) {
        const intentionMatch = text.match(this.patterns.intentionLine);
        const commandMatch = text.match(this.patterns.commandLine);
        const descriptionMatch = text.match(this.patterns.descriptionLine);
        const levelMatch = text.match(this.patterns.levelLine);
        
        if (intentionMatch && commandMatch && descriptionMatch) {
            const intention = intentionMatch[1].trim();
            
            if (this.isSystemCommandIntention(intention)) {
                return {
                    intention: intention,
                    command: this.cleanCommand(commandMatch[1].trim()),
                    description: descriptionMatch[1].trim(),
                    level: levelMatch ? levelMatch[1].trim().toUpperCase() : 'MEDIUM'
                };
            }
        }
        
        return null;
    }

    /**
     * Clean command text by removing markdown formatting and unwanted characters
     * @param {string} command - The raw command text
     * @returns {string} Cleaned command
     */
    cleanCommand(command) {
        // Remove markdown formatting
        let cleaned = command
            .replace(/\*\*(.+?)\*\*/g, '$1')  // Remove bold **text**
            .replace(/\*(.+?)\*/g, '$1')      // Remove italic *text*
            .replace(/`(.+?)`/g, '$1')        // Remove code `text`
            .replace(/^[*\-+\s]*/, '')        // Remove list markers and leading spaces
            .replace(/[*\-+\s]*$/, '')        // Remove trailing markers and spaces
            .trim();
        
        // Remove any remaining unwanted characters at the start
        cleaned = cleaned.replace(/^[^\w\/\\%]+/, '');
        
        return cleaned;
    }

    /**
     * Check if the intention indicates a system command
     * @param {string} intention - The intention string
     * @returns {boolean} True if it's a system command intention
     */    isSystemCommandIntention(intention) {
        const systemKeywords = [
            'system command',
            'system modification',
            'system',
            'command',
            'execute',
            'run',
            'list files',
            'directory',
            'file operation',
            'system query',
            'modification'
        ];
        
        const lowerIntention = intention.toLowerCase();
        return systemKeywords.some(keyword => lowerIntention.includes(keyword));
    }

    /**
     * Convert Unix/Linux commands to Windows equivalents
     * @param {string} command - The original command
     * @returns {string} Windows-compatible command
     */
    convertToWindowsCommand(command) {
        // Common command conversions
        const conversions = {
            'ls': 'dir',
            'ls -la': 'dir /a',
            'ls -l': 'dir',
            'cat': 'type',
            'grep': 'findstr',
            'pwd': 'cd',
            'whoami': 'whoami',
            'ps': 'tasklist',
            'kill': 'taskkill',
            'cp': 'copy',
            'mv': 'move',
            'rm': 'del',
            'mkdir': 'mkdir',
            'rmdir': 'rmdir'
        };

        let windowsCommand = command;

        // Replace common Unix paths with Windows equivalents
        windowsCommand = windowsCommand.replace(/~/g, '%USERPROFILE%');
        windowsCommand = windowsCommand.replace(/\/home\/\w+/g, '%USERPROFILE%');
        
        // Convert forward slashes to backslashes for paths
        windowsCommand = windowsCommand.replace(/\/([A-Za-z0-9_.-]+)/g, '\\$1');

        // Apply command conversions
        for (const [unix, windows] of Object.entries(conversions)) {
            const regex = new RegExp(`\\b${unix}\\b`, 'g');
            windowsCommand = windowsCommand.replace(regex, windows);
        }

        return windowsCommand;
    }

    /**
     * Clean and prepare response text for display
     * @param {string} response - The response text
     * @returns {string} Cleaned response
     */
    cleanResponseText(response) {
        // Remove code blocks from the main text for display
        let cleanText = response.replace(this.patterns.codeBlock, '').trim();
        
        // Remove extra whitespace and newlines
        cleanText = cleanText.replace(/\n\s*\n/g, '\n').trim();
        
        return cleanText;
    }
}

// Export for use in renderer
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ResponseParser;
} else {
    window.ResponseParser = ResponseParser;
}
