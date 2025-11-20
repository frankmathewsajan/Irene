/**
 * Enhanced Markdown to HTML converter - Optimized
 * Handles Gemini markdown formatting including ordered lists
 */

class MarkdownFormatter {
    constructor() {
        this.patterns = {
            bold: /\*\*(.*?)\*\*|__(.*?)__/g,
            italic: /(?<!\*)\*([^*\n]+)\*(?!\*)|(?<!_)_([^_\n]+)_(?!_)/g,
            inlineCode: /`([^`\n]+)`/g,
            codeBlock: /```(\w+)?\n?([\s\S]*?)```/g,
            links: /\[([^\]]+)\]\(([^)]+)\)/g,
            headers: /^(#{1,6})\s+(.+)$/gm,
            strikethrough: /~~(.*?)~~/g,
            markdown: /\*\*|__|`|```|#{1,6}|[-*+]\s|\d+\.\s|\[.*\]\(.*\)|~~/
        };
    }

    toHTML(markdown) {
        if (!markdown || typeof markdown !== 'string') return '';

        let html = markdown;

        // Code blocks first (preserve content)
        html = html.replace(this.patterns.codeBlock, (_, lang, code) => {
            const langAttr = lang ? ` data-language="${lang}"` : '';
            return `<pre class="code-block"${langAttr}><code>${this.escapeHtml(code.trim())}</code></pre>`;
        });

        // Inline code
        html = html.replace(this.patterns.inlineCode, (_, code) => 
            `<code class="inline-code">${this.escapeHtml(code)}</code>`);

        // Headers
        html = html.replace(this.patterns.headers, (_, hashes, text) => {
            const lvl = hashes.length;
            return `<h${lvl} class="markdown-h${lvl}">${text.trim()}</h${lvl}>`;
        });

        // Lists (before other formatting)
        html = this.processLists(html);

        // Text formatting
        html = html.replace(this.patterns.bold, (_, t1, t2) => `<strong>${t1 || t2}</strong>`);
        html = html.replace(this.patterns.italic, (_, t1, t2) => `<em>${t1 || t2}</em>`);
        html = html.replace(this.patterns.strikethrough, (_, t) => `<del>${t}</del>`);
        html = html.replace(this.patterns.links, (_, text, url) => 
            `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`);

        return this.formatParagraphs(html).trim();
    }

    processLists(html) {
        const lines = html.split('\n');
        const result = [];
        const stack = [];
        
        lines.forEach(line => {
            const trimmed = line.trim();
            const unordered = trimmed.match(/^[-*+]\s+(.+)$/);
            const ordered = trimmed.match(/^(\d{1,3})\.\s+(.+)$/);
            
            if (unordered) {
                this.handleListItem(result, stack, 'ul', unordered[1]);
            } else if (ordered) {
                this.handleListItem(result, stack, 'ol', ordered[2]);
            } else if (trimmed === '' && stack.length > 0) {
                result.push('');
            } else {
                this.closeAllLists(result, stack);
                result.push(line);
            }
        });
        
        this.closeAllLists(result, stack);
        return result.join('\n');
    }

    handleListItem(result, stack, type, content) {
        if (stack.length === 0 || stack[stack.length - 1] !== type) {
            result.push(`<${type} class="markdown-${type}">`);
            stack.push(type);
        }
        result.push(`<li>${content}</li>`);
    }

    closeAllLists(result, stack) {
        while (stack.length > 0) {
            result.push(`</${stack.pop()}>`);
        }
    }

    formatParagraphs(html) {
        return html.split(/\n\s*\n/)
            .map(block => {
                const trimmed = block.trim();
                if (!trimmed || /<(ul|ol|pre|h|li)/.test(trimmed)) return trimmed;
                return `<p class="markdown-p">${trimmed.replace(/\n/g, '<br>')}</p>`;
            })
            .filter(p => p)
            .join('\n\n');
    }

    escapeHtml(text) {
        if (typeof document !== 'undefined') {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    containsMarkdown(text) { return this.patterns.markdown.test(text); }

    test(markdown) {
        const html = this.toHTML(markdown);
        return {
            input: markdown, output: html,
            hasOrderedList: html.includes('<ol'), hasUnorderedList: html.includes('<ul'),
            hasBold: html.includes('<strong>'), hasItalic: html.includes('<em>'),
            hasCode: html.includes('<code>'), hasHeaders: html.includes('<h')
        };
    }

    toPlainText(markdown) {
        if (!markdown || typeof markdown !== 'string') return '';
        
        return markdown
            .replace(/```[\s\S]*?```/g, '')
            .replace(/`[^`]+`/g, '')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/__(.*?)__/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/_(.*?)_/g, '$1')
            .replace(/~~(.*?)~~/g, '$1')
            .replace(/^#{1,6}\s+/gm, '')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/^[-*+]\s+/gm, '')
            .replace(/^\d+\.\s+/gm, '')
            .trim();
    }

    debug(markdown, verbose = false) {
        if (verbose) {
            console.log('=== MARKDOWN DEBUG ===');
            console.log('Input:', markdown, '\nLines:', markdown.split('\n'));
        }
        const result = this.toHTML(markdown);
        if (verbose) console.log('Output:', result, '\n=== END DEBUG ===');
        return result;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MarkdownFormatter;
} else {
    window.MarkdownFormatter = MarkdownFormatter;
}
