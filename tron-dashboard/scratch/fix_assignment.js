const fs = require('fs');
const file = 'src/app/team/AssignmentForm.jsx';
let content = fs.readFileSync(file, 'utf8');

// Card Containers
content = content.replace(/className="bg-white rounded-2xl shadow-\[0_8px_30px_rgb\(0,0,0,0\.04\)\] border border-gray-100 overflow-hidden mb-8"/g, 'className="bg-white border-4 border-black shadow-brutal-lg flex flex-col mb-8"');
content = content.replace(/className="p-6 sm:p-8 border-b border-gray-100 bg-gray-50\/50 flex items-center justify-between"/g, 'className="p-6 border-b-4 border-black bg-brutal-orange flex items-center justify-between"');

// Titles inside cards
content = content.replace(/className="text-xl font-bold text-gray-900"/g, 'className="text-3xl font-black uppercase text-black"');
content = content.replace(/className="text-sm text-gray-500 mt-1"/g, 'className="font-mono font-bold text-black mt-1"');

// SVG icons container
content = content.replace(/className="hidden sm:flex h-12 w-12 bg-purple-50 rounded-full items-center justify-center text-purple-600"/g, 'className="hidden sm:flex h-16 w-16 bg-white border-4 border-black items-center justify-center text-black shadow-brutal"');

// Form elements
content = content.replace(/className="block text-sm font-semibold text-gray-700 mb-2"/g, 'className="block font-black text-xl mb-2 uppercase text-black"');
content = content.replace(/className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"/g, 'className="input-brutal text-black"');
content = content.replace(/className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-sm transition-all duration-200 disabled:opacity-60"/g, 'className="btn-brutal bg-brutal-blue text-black px-6 py-4 text-xl mt-4 disabled:opacity-50"');

// Message boxes
content = content.replace(/className=\{`p-4 rounded-xl text-sm flex items-start \$\{status\.type === 'success' \? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100'\}`\}/g, 'className={`mb-6 p-4 border-4 border-black font-black uppercase text-center shadow-brutal text-black ${status.type === \\\'success\\\' ? \\\'bg-brutal-green\\\' : \\\'bg-brutal-pink\\\'}`}');
content = content.replace(/className="font-medium"/g, 'className="font-mono font-bold"');

fs.writeFileSync(file, content);
