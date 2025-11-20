/**
 * Irene Response Parser - Optimized
 * Parses Gemini API responses to extract system commands
 */

class ResponseParser {
    constructor() {
        this.patterns = {
            codeBlock: /```[\s\S]*?```/g,
            jsonCommand: /\{\s*INTENTION:\s*(.+?)\s*COMMAND:\s*(.+?)\s*DESCRIPTION:\s*(.+?)\s*LEVEL:\s*(.+?)\s*\}/s,
            structuredCommand: /INTENTION:\s*(.+?)\s*\nCOMMAND:\s*(.+?)\s*\nDESCRIPTION:\s*(.+?)(?:\n|$)/s,
            intentionLine: /INTENTION:\s*(.+)/i,
            commandLine: /COMMAND:\s*(.+)/i,
            descriptionLine: /DESCRIPTION:\s*(.+)/i,
            levelLine: /LEVEL:\s*(.+)/i
        };
        this.systemKeywords = ['system command', 'system modification', 'system', 'command', 'execute', 
                              'run', 'list files', 'directory', 'file operation', 'system query', 'modification'];
        this.cmdMap = {
            'ls': 'dir', 'ls -la': 'dir /a', 'ls -l': 'dir', 'cat': 'type', 'grep': 'findstr',
            'pwd': 'cd', 'ps': 'tasklist', 'kill': 'taskkill', 'cp': 'copy', 'mv': 'move',
            'rm': 'del', 'mkdir': 'mkdir', 'rmdir': 'rmdir'
        };
    }

    parseResponse(response) {
        console.log('Parsing:', response.substring(0, 200) + '...');
        
        const blocks = this.extractCodeBlocks(response);
        for (const block of blocks) {
            const cmd = this.parseCodeBlock(block);
            if (cmd) return { type: 'system_command', command: cmd, originalResponse: response, codeBlock: block };
        }
        
        const fallback = this.parseStructuredFormat(response);
        if (fallback) return { type: 'system_command', command: fallback, originalResponse: response, codeBlock: null };
        
        return { type: 'chat', message: response, originalResponse: response };
    }

    extractCodeBlocks(response) {
        return (response.match(this.patterns.codeBlock) || [])
            .map(m => m.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim());
    }

    parseCodeBlock(content) {
        // Try JSON-like format
        let match = content.match(this.patterns.jsonCommand);
        if (match && this.isSystemCmd(match[1])) {
            return {
                intention: match[1].trim(),
                command: this.cleanCmd(match[2].trim()),
                description: match[3].trim(),
                level: match[4].trim().toUpperCase()
            };
        }
        
        // Try legacy format
        match = content.match(this.patterns.structuredCommand);
        if (match && this.isSystemCmd(match[1])) {
            return {
                intention: match[1].trim(),
                command: this.cleanCmd(match[2].trim()),
                description: match[3].trim(),
                level: 'MEDIUM'
            };
        }
        
        return null;
    }

    parseStructuredFormat(text) {
        const int = text.match(this.patterns.intentionLine);
        const cmd = text.match(this.patterns.commandLine);
        const desc = text.match(this.patterns.descriptionLine);
        const lvl = text.match(this.patterns.levelLine);
        
        return (int && cmd && desc && this.isSystemCmd(int[1])) ? {
            intention: int[1].trim(),
            command: this.cleanCmd(cmd[1].trim()),
            description: desc[1].trim(),
            level: lvl ? lvl[1].trim().toUpperCase() : 'MEDIUM'
        } : null;
    }

    cleanCmd(cmd) {
        return cmd
            .replace(/\*\*(.+?)\*\*/g, '$1')
            .replace(/\*(.+?)\*/g, '$1')
            .replace(/`(.+?)`/g, '$1')
            .replace(/^[*\-+\s]*/, '')
            .replace(/[*\-+\s]*$/, '')
            .replace(/^[^\w\/\\%]+/, '')
            .trim();
    }

    isSystemCmd(intention) {
        const lower = intention.toLowerCase();
        return this.systemKeywords.some(k => lower.includes(k));
    }

    convertToWindowsCommand(cmd) {
        let win = cmd
            .replace(/~/g, '%USERPROFILE%')
            .replace(/\/home\/\w+/g, '%USERPROFILE%')
            .replace(/\/([A-Za-z0-9_.-]+)/g, '\\$1');
        
        Object.entries(this.cmdMap).forEach(([unix, windows]) => {
            win = win.replace(new RegExp(`\\b${unix}\\b`, 'g'), windows);
        });
        
        return win;
    }

    cleanResponseText(response) {
        return response
            .replace(this.patterns.codeBlock, '')
            .replace(/\n\s*\n/g, '\n')
            .trim();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ResponseParser;
} else {
    window.ResponseParser = ResponseParser;
}
