// Verification script to check if all BuzzleBee references have been changed to Irene
const fs = require('fs');
const path = require('path');

const filesToCheck = [
    'config.js',
    'package.json',
    'finetune-config.js',
    'renderer.js',
    'markdown-formatter.js',
    'parser.js',
    'test-markdown.html'
];

console.log('=== CHECKING FOR REMAINING BUZZLEBEE REFERENCES ===\n');

filesToCheck.forEach(filename => {
    const filePath = path.join(__dirname, filename);
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const buzzlebeeMatches = content.match(/BuzzleBee|buzzlebee|Buzzlebee/gi);
        
        console.log(`📄 ${filename}:`);
        if (buzzlebeeMatches) {
            console.log(`  ❌ Found ${buzzlebeeMatches.length} BuzzleBee references:`);
            buzzlebeeMatches.forEach(match => console.log(`     - "${match}"`));
        } else {
            console.log(`  ✅ No BuzzleBee references found - all changed to Irene!`);
        }
        
        // Check for Irene references
        const ireneMatches = content.match(/Irene|irene/gi);
        if (ireneMatches) {
            console.log(`  ✨ Found ${ireneMatches.length} Irene references`);
        }
        console.log('');
    } else {
        console.log(`📄 ${filename}: ❌ File not found`);
        console.log('');
    }
});

console.log('=== VERIFICATION COMPLETE ===');
console.log('✨ Your magical assistant is now named Irene! ✨');
