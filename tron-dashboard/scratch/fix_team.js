const fs = require('fs');
const file = 'src/app/team/page.jsx';
let content = fs.readFileSync(file, 'utf8');

// Container
content = content.replace(/className="max-w-5xl mx-auto p-6 lg:p-8 font-sans"/g, 'className="max-w-7xl mx-auto p-8 font-sans"');
content = content.replace(/className="mb-10"/g, 'className="mb-8 border-b-8 border-black pb-4"');
content = content.replace(/className="text-3xl font-extrabold text-gray-900 tracking-tight"/g, 'className="text-5xl font-black uppercase text-black tracking-tight"');
content = content.replace(/className="text-gray-500 mt-2 text-lg"/g, 'className="font-mono text-xl font-bold text-black mt-2"');

// Card Containers
content = content.replace(/className="bg-white rounded-2xl shadow-\[0_8px_30px_rgb\(0,0,0,0\.04\)\] border border-gray-100 overflow-hidden mb-8"/g, 'className="bg-white border-4 border-black shadow-brutal-lg flex flex-col mb-8"');
content = content.replace(/className="p-6 sm:p-8 border-b border-gray-100 bg-gray-50\/50 flex items-center justify-between"/g, 'className="p-6 border-b-4 border-black bg-brutal-pink flex items-center justify-between"');

// Titles inside cards
content = content.replace(/className="text-xl font-bold text-gray-900"/g, 'className="text-3xl font-black uppercase text-black"');
content = content.replace(/className="text-sm text-gray-500 mt-1"/g, 'className="font-mono font-bold text-black mt-1"');

// SVG icons container
content = content.replace(/className="hidden sm:flex h-12 w-12 bg-indigo-50 rounded-full items-center justify-center text-indigo-600"/g, 'className="hidden sm:flex h-16 w-16 bg-white border-4 border-black items-center justify-center text-black shadow-brutal"');
content = content.replace(/className="hidden sm:flex h-12 w-12 bg-sky-50 rounded-full items-center justify-center text-sky-600"/g, 'className="hidden sm:flex h-16 w-16 bg-white border-4 border-black items-center justify-center text-black shadow-brutal"');
content = content.replace(/className="hidden sm:flex h-12 w-12 bg-emerald-50 rounded-full items-center justify-center text-emerald-600"/g, 'className="hidden sm:flex h-16 w-16 bg-white border-4 border-black items-center justify-center text-black shadow-brutal"');

// Form elements
content = content.replace(/className="block text-sm font-semibold text-gray-700 mb-2"/g, 'className="block font-black text-xl mb-2 uppercase text-black"');
content = content.replace(/className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"/g, 'className="input-brutal pl-11 text-black"');
content = content.replace(/className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-sm transition-all duration-200 disabled:opacity-60"/g, 'className="btn-brutal bg-brutal-blue text-black px-6 py-4 text-xl mt-4 disabled:opacity-50 w-full md:w-auto"');

// Message boxes
content = content.replace(/className=\{`mb-6 p-4 rounded-xl text-sm flex items-start \$\{status\.type === 'success' \? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100'\}`\}/g, 'className={`mb-6 p-4 border-4 border-black font-black uppercase text-center shadow-brutal text-black ${status.type === \'success\' ? \'bg-brutal-green\' : \'bg-brutal-pink\'}`}');
content = content.replace(/className="font-medium"/g, 'className="font-mono font-bold"');

// Lists
content = content.replace(/className="divide-y divide-gray-100"/g, 'className="divide-y-4 divide-black"');
content = content.replace(/className="p-6 sm:p-8 hover:bg-gray-50\/50 transition-colors"/g, 'className="p-6 sm:p-8 bg-white hover:bg-brutal-orange transition-colors"');
content = content.replace(/className="h-10 w-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-sm shrink-0"/g, 'className="h-12 w-12 border-4 border-black bg-black text-white flex items-center justify-center font-black text-xl shrink-0"');
content = content.replace(/className="text-sm font-bold text-gray-900"/g, 'className="text-2xl font-black uppercase text-black"');
content = content.replace(/className="flex items-center gap-2 mt-1 text-xs font-medium text-gray-500"/g, 'className="flex items-center gap-2 mt-2 text-sm font-mono font-bold text-black"');
content = content.replace(/className="text-indigo-600 bg-indigo-50 px-2 py-0\.5 rounded-md"/g, 'className="text-black bg-brutal-blue border-2 border-black px-2 py-1 shadow-brutal uppercase"');
content = content.replace(/className="text-emerald-700 bg-emerald-50 px-2 py-0\.5 rounded-md"/g, 'className="text-black bg-brutal-green border-2 border-black px-2 py-1 shadow-brutal uppercase"');
content = content.replace(/className="text-gray-500 bg-gray-100 px-2 py-0\.5 rounded-md"/g, 'className="text-black bg-gray-200 border-2 border-black px-2 py-1 shadow-brutal uppercase"');

// Buttons inside lists
content = content.replace(/className="text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1\.5 rounded-md text-xs font-bold transition-colors border border-transparent"/g, 'className="btn-brutal bg-brutal-pink text-black px-4 py-2"');
content = content.replace(/className="text-red-600 hover:text-red-700 font-semibold text-xs border border-red-100 hover:bg-red-50 px-3 py-1\.5 rounded-md transition-all"/g, 'className="btn-brutal bg-brutal-pink text-black px-4 py-2"');

fs.writeFileSync(file, content);
