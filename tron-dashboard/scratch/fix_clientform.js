const fs = require('fs');
const file = 'src/app/repositories/ClientForm.jsx';
let content = fs.readFileSync(file, 'utf8');

// Inputs
content = content.replace(/className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"/g, 'className="input-brutal text-black"');
content = content.replace(/className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm placeholder-gray-400 font-mono"/g, 'className="input-brutal text-black"');

// Selects
content = content.replace(/className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"/g, 'className="input-brutal text-black"');
content = content.replace(/className="w-full sm:w-1\/3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"/g, 'className="input-brutal text-black"');
content = content.replace(/className="w-full sm:w-2\/3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"/g, 'className="input-brutal text-black"');

// Labels
content = content.replace(/className="block text-sm font-semibold text-gray-900"/g, 'className="block font-black text-xl mb-2 uppercase text-black"');
content = content.replace(/className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 block"/g, 'className="block font-black text-lg mb-2 uppercase text-black"');

// Buttons
content = content.replace(/className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-4 px-4 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-lg"/g, 'className="btn-brutal w-full py-4 bg-brutal-orange text-2xl text-black disabled:opacity-50"');

// Notice boxes
content = content.replace(/className="w-full px-4 py-3 border border-red-200 rounded-xl bg-red-50 text-red-700 text-sm flex justify-between items-center"/g, 'className="w-full p-4 border-4 border-black bg-brutal-pink text-black font-mono font-bold shadow-brutal flex justify-between items-center"');
content = content.replace(/className="w-full px-4 py-3 border border-red-200 rounded-xl bg-red-50 text-red-700 text-sm font-medium"/g, 'className="w-full p-4 border-4 border-black bg-brutal-pink text-black font-mono font-bold shadow-brutal"');
content = content.replace(/className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-400 text-sm animate-pulse"/g, 'className="w-full p-4 border-4 border-black bg-white text-black font-mono font-bold shadow-brutal animate-pulse"');
content = content.replace(/className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-8"/g, 'className="bg-white border-4 border-black p-6 mb-8 shadow-brutal"');
content = content.replace(/className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 mb-8"/g, 'className="bg-brutal-green border-4 border-black p-6 mb-8 shadow-brutal"');
content = content.replace(/className="text-gray-800 font-bold mb-1"/g, 'className="font-black text-2xl uppercase text-black mb-2"');
content = content.replace(/className="text-emerald-800 font-bold mb-1"/g, 'className="font-black text-2xl uppercase text-black mb-2"');
content = content.replace(/className="text-sm text-gray-600"/g, 'className="font-mono text-black font-bold"');
content = content.replace(/className="text-sm text-emerald-700"/g, 'className="font-mono text-black font-bold"');
content = content.replace(/className="text-indigo-600 font-semibold hover:underline mt-2 inline-block"/g, 'className="btn-brutal bg-white px-4 py-2 mt-4 inline-block text-black text-center"');

// Basecamp columns grid
content = content.replace(/className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4"/g, 'className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6"');

// Status messages
content = content.replace(/className=\{`p-4 rounded-xl text-sm font-medium text-center \$\{status\.type === 'success' \? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'\}`\}/g, 'className={`p-4 border-4 border-black font-black uppercase text-center shadow-brutal text-black ${status.type === \'success\' ? \'bg-brutal-green\' : \'bg-brutal-pink\'}`}');

// Links to buttons
content = content.replace(/className="font-bold underline hover:text-red-900"/g, 'className="btn-brutal bg-white px-4 py-2 text-black"');


fs.writeFileSync(file, content);
