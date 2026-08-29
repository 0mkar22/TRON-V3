const fs = require('fs');

function fixFile(filePath, replacements) {
    let content = fs.readFileSync(filePath, 'utf8');
    let lines = content.split('\n');
    for (let r of replacements) {
        let lineIdx = r.line - 1;
        lines[lineIdx] = lines[lineIdx].replace('await .from', 'await ' + r.var + '.from');
    }
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log('Fixed', filePath);
}

fixFile('src/app/activity/page.jsx', [
    { line: 22, var: 'supabase' }
]);

fixFile('src/app/integrations/page.jsx', [
    { line: 22, var: 'supabase' },
    { line: 51, var: 'supabaseServer' },
    { line: 104, var: 'supabaseServer' },
    { line: 216, var: 'supabaseServer' }
]);

fixFile('src/app/repositories/page.jsx', [
    { line: 14, var: 'supabase' }
]);
