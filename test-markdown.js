const MarkdownFormatter = require('./markdown-formatter.js');

// Create formatter instance
const formatter = new MarkdownFormatter();

// Test ordered lists specifically
const testMarkdown = `Here are the steps:

1. First step
2. Second step with **bold text**
3. Third step with *italic*
4. Fourth step

And unordered list:

- Bullet one
- Bullet two
- Bullet three

Mixed content:

1. Step one
2. Step two

Some paragraph text here.

3. Step three
4. Step four`;

console.log('=== TESTING ORDERED LISTS ===');
console.log('Input:');
console.log(testMarkdown);
console.log('\n--- OUTPUT ---');

const result = formatter.toHTML(testMarkdown);
console.log(result);

// Test individual features
const tests = [
    '1. Simple ordered item',
    '- Simple bullet item',
    '**Bold text**',
    '*Italic text*',
    '`inline code`'
];

console.log('\n=== INDIVIDUAL TESTS ===');
tests.forEach(test => {
    console.log(`Input: "${test}"`);
    console.log(`Output: ${formatter.toHTML(test)}`);
    console.log('---');
});
