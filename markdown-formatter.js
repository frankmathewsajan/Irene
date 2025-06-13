/**
 * Enhanced Markdown to HTML converter for Irene chat messages
 * Properly handles Gemini markdown formatting including ordered lists
 */

class MarkdownFormatter {
    constructor() {
        this.patterns = {
            // Bold text **text** or __text__
            bold: /\*\*(.*?)\*\*|__(.*?)__/g,
            // Italic text *text* or _text_ (avoiding conflicts with bold)
            italic: /(?<!\*)\*([^*\n]+)\*(?!\*)|(?<!_)_([^_\n]+)_(?!_)/g,
            // Inline code `code`
            inlineCode: /`([^`\n]+)`/g,
            // Code blocks ```code``` or ```language\ncode```
            codeBlock: /```(\w+)?\n?([\s\S]*?)```/g,
            // Links [text](url)
            links: /\[([^\]]+)\]\(([^)]+)\)/g,
            // Headers # ## ### etc
            headers: /^(#{1,6})\s+(.+)$/gm,
            // Strikethrough ~~text~~
            strikethrough: /~~(.*?)~~/g
        };
    }

    /**
     * Convert markdown text to HTML
     * @param {string} markdown - The markdown text to convert
     * @returns {string} - The converted HTML
     */
    toHTML(markdown) {
        if (!markdown || typeof markdown !== 'string') {
            return '';
        }

        let html = markdown;

        // Handle code blocks first (to avoid processing markdown inside them)
        html = html.replace(this.patterns.codeBlock, (match, language, code) => {
            const lang = language ? ` data-language="${language}"` : '';
            return `<pre class="code-block"${lang}><code>${this.escapeHtml(code.trim())}</code></pre>`;
        });

        // Handle inline code (before other formatting)
        html = html.replace(this.patterns.inlineCode, (match, code) => {
            return `<code class="inline-code">${this.escapeHtml(code)}</code>`;
        });

        // Handle headers
        html = html.replace(this.patterns.headers, (match, hashes, text) => {
            const level = hashes.length;
            return `<h${level} class="markdown-h${level}">${text.trim()}</h${level}>`;
        });

        // Handle lists BEFORE other formatting to preserve structure
        html = this.processLists(html);

        // Handle bold text
        html = html.replace(this.patterns.bold, (match, text1, text2) => {
            const text = text1 || text2;
            return `<strong>${text}</strong>`;
        });

        // Handle italic text
        html = html.replace(this.patterns.italic, (match, text1, text2) => {
            const text = text1 || text2;
            return `<em>${text}</em>`;
        });

        // Handle strikethrough
        html = html.replace(this.patterns.strikethrough, (match, text) => {
            return `<del>${text}</del>`;
        });

        // Handle links
        html = html.replace(this.patterns.links, (match, text, url) => {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
        });

        // Handle paragraphs and line breaks
        html = this.formatParagraphs(html);

        return html.trim();
    }

    /**
     * Process both ordered and unordered lists
     * @param {string} html - The HTML string
     * @returns {string} - The formatted HTML with lists
     */
    processLists(html) {
        const lines = html.split('\n');
        let result = [];
        let listStack = []; // Stack to handle nested lists
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
              // Check for unordered list items (-, *, +)
            const unorderedMatch = trimmedLine.match(/^[-*+]\s+(.+)$/);
            // Check for ordered list items (1., 2., etc.) - more flexible
            const orderedMatch = trimmedLine.match(/^(\d{1,3})\.\s+(.+)$/);
            
            if (unorderedMatch) {
                this.handleListItem(result, listStack, 'ul', unorderedMatch[1]);
            } else if (orderedMatch) {
                this.handleListItem(result, listStack, 'ol', orderedMatch[2]);
            } else if (trimmedLine === '' && listStack.length > 0) {
                // Empty line within a list - keep list open but add line break
                result.push('');
            } else {
                // Not a list item, close any open lists
                this.closeAllLists(result, listStack);
                result.push(line);
            }
        }
        
        // Close any remaining open lists
        this.closeAllLists(result, listStack);
        
        return result.join('\n');
    }

    /**
     * Handle individual list items
     * @param {Array} result - Result array to push to
     * @param {Array} listStack - Stack of open lists
     * @param {string} listType - 'ul' or 'ol'
     * @param {string} content - List item content
     */
    handleListItem(result, listStack, listType, content) {
        // If no list is open or different type, start new list
        if (listStack.length === 0 || listStack[listStack.length - 1] !== listType) {
            result.push(`<${listType} class="markdown-${listType}">`);
            listStack.push(listType);
        }
        
        result.push(`<li>${content}</li>`);
    }

    /**
     * Close all open lists
     * @param {Array} result - Result array to push to
     * @param {Array} listStack - Stack of open lists
     */
    closeAllLists(result, listStack) {
        while (listStack.length > 0) {
            const listType = listStack.pop();
            result.push(`</${listType}>`);
        }
    }    /**
     * Format paragraphs and line breaks
     * @param {string} html - The HTML string
     * @returns {string} - The formatted HTML
     */
    formatParagraphs(html) {
        // Split by double newlines to create paragraphs
        const blocks = html.split(/\n\s*\n/);
        
        return blocks.map(block => {
            const trimmed = block.trim();
            if (!trimmed) return '';
            
            // Don't wrap lists, code blocks, or headers in paragraphs
            if (trimmed.includes('<ul') || 
                trimmed.includes('<ol') || 
                trimmed.includes('<pre') || 
                trimmed.includes('<h') ||
                trimmed.includes('<li>')) {
                return trimmed;
            }
            
            // Regular paragraph - replace single newlines with <br>
            const withBreaks = trimmed.replace(/\n/g, '<br>');
            return `<p class="markdown-p">${withBreaks}</p>`;
        }).filter(p => p).join('\n\n');
    }/**
     * Escape HTML characters
     * @param {string} text - Text to escape
     * @returns {string} - Escaped text
     */
    escapeHtml(text) {
        if (typeof document !== 'undefined') {
            // Browser environment
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        } else {
            // Node.js environment - manual escaping
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }
    }

    /**
     * Simple method to check if text contains markdown
     * @param {string} text - Text to check
     * @returns {boolean} - True if contains markdown
     */
    containsMarkdown(text) {
        return /\*\*|__|`|```|#{1,6}|[-*+]\s|\d+\.\s|\[.*\]\(.*\)|~~/.test(text);
    }

    /**
     * Test method to validate markdown conversion
     * @param {string} markdown - Test markdown
     * @returns {Object} - Test results
     */
    test(markdown) {
        const html = this.toHTML(markdown);
        return {
            input: markdown,
            output: html,
            hasOrderedList: html.includes('<ol'),
            hasUnorderedList: html.includes('<ul'),
            hasBold: html.includes('<strong>'),
            hasItalic: html.includes('<em>'),
            hasCode: html.includes('<code>'),
            hasHeaders: html.includes('<h')
        };
    }

    /**
     * Clean text of markdown formatting (for plain text version)
     * @param {string} markdown - Markdown text
     * @returns {string} - Plain text
     */
    toPlainText(markdown) {
        if (!markdown || typeof markdown !== 'string') {
            return '';
        }
        
        let text = markdown;
        
        // Remove code blocks
        text = text.replace(/```[\s\S]*?```/g, '');
        
        // Remove inline code
        text = text.replace(/`[^`]+`/g, '');
        
        // Remove bold formatting
        text = text.replace(/\*\*(.*?)\*\*/g, '$1');
        text = text.replace(/__(.*?)__/g, '$1');
        
        // Remove italic formatting
        text = text.replace(/\*(.*?)\*/g, '$1');
        text = text.replace(/_(.*?)_/g, '$1');
        
        // Remove strikethrough
        text = text.replace(/~~(.*?)~~/g, '$1');
        
        // Remove headers
        text = text.replace(/^#{1,6}\s+/gm, '');
        
        // Remove links, keep text
        text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
        
        // Remove list markers
        text = text.replace(/^[-*+]\s+/gm, '');
        text = text.replace(/^\d+\.\s+/gm, '');
        
        return text.trim();
    }

    /**
     * Debug method to log parsing steps
     * @param {string} markdown - Markdown to debug
     * @param {boolean} verbose - Whether to log detailed steps
     */
    debug(markdown, verbose = false) {
        if (verbose) {
            console.log('=== MARKDOWN DEBUG ===');
            console.log('Input:', markdown);
            console.log('Lines:', markdown.split('\n'));
        }
        
        const result = this.toHTML(markdown);
        
        if (verbose) {
            console.log('Output:', result);
            console.log('=== END DEBUG ===');
        }
        
        return result;
    }
}

// Export for use in renderer
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MarkdownFormatter;
} else {
    window.MarkdownFormatter = MarkdownFormatter;
}
