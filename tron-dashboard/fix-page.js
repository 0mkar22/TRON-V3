const fs = require('fs');
let content = fs.readFileSync('src/app/page.js', 'utf8');
content = content.replace('import LiveTerminal from \'@/components/maximalist/LiveTerminal\';\r\n\r\n// ... (in the component)\r\n', '');
content = content.replace('import LiveTerminal from \'@/components/maximalist/LiveTerminal\';\n\n// ... (in the component)\n', '');
content = import LiveTerminal from '@/components/maximalist/LiveTerminal';\n + content;
fs.writeFileSync('src/app/page.js', content, 'utf8');
