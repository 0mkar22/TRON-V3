import Link from 'next/link';

export default function Home() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      
      {/* Hero / System Status Section */}
      <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center">
        <div className="text-center md:text-left">
          <h1 className="text-3xl font-extrabold text-gray-900">Welcome to T.R.O.N. V3</h1>
          <p className="text-gray-500 mt-2 text-lg">Your automated project management and AI code review engine is online.</p>
        </div>
        <div className="mt-6 md:mt-0">
            <span className="inline-flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-full font-semibold text-sm shadow-sm">
              <span className="w-2.5 h-2.5 bg-green-500 rounded-full mr-2 animate-pulse"></span>
              Engine Active
            </span>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Integrations Card */}
        <Link href="/integrations" className="block group">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-green-400 transition-all duration-200 h-full">
            <div className="text-4xl mb-4">🔌</div>
            <h3 className="text-xl font-bold text-gray-800 group-hover:text-green-600 transition-colors">Integrations</h3>
            <p className="text-gray-500 mt-2 text-sm leading-relaxed">
              Connect your PM tools (Basecamp, Jira, Monday) and link your communication channels (Discord, Slack).
            </p>
          </div>
        </Link>

        {/* Repositories Card */}
        <Link href="/repositories" className="block group">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-green-400 transition-all duration-200 h-full">
            <div className="text-4xl mb-4">📦</div>
            <h3 className="text-xl font-bold text-gray-800 group-hover:text-green-600 transition-colors">Repositories</h3>
            <p className="text-gray-500 mt-2 text-sm leading-relaxed">
              Map your GitHub repositories to your PM boards and configure automated webhook column movements.
            </p>
          </div>
        </Link>

        {/* Mission Control Card */}
        <Link href="/activity" className="block group">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-green-400 transition-all duration-200 h-full">
            <div className="text-4xl mb-4">🚀</div>
            <h3 className="text-xl font-bold text-gray-800 group-hover:text-green-600 transition-colors">Mission Control</h3>
            <p className="text-gray-500 mt-2 text-sm leading-relaxed">
              Monitor live AI code reviews, Git webhook deliveries, and the Redis background worker queue.
            </p>
          </div>
        </Link>

      </div>

      {/* VS Code Extension Banner */}
      <div className="bg-gray-900 rounded-xl p-8 shadow-lg text-white flex flex-col md:flex-row items-center justify-between border border-gray-800 mt-8">
        <div className="mb-4 md:mb-0">
            <h3 className="text-xl font-bold flex items-center text-blue-400">
              <span className="mr-3 text-2xl">💻</span> VS Code Extension
            </h3>
            <p className="text-gray-400 mt-2 text-sm max-w-2xl leading-relaxed">
              Maximize your workflow. Install the TRON VSIX file in your editor to enable 1-click branch creation, automatic code stashing, and Basecamp developer auto-assignment.
            </p>
        </div>
        <div className="flex-shrink-0">
           <div className="bg-gray-800 border border-gray-700 px-4 py-2 rounded text-sm font-mono text-gray-300">
             npm run build
           </div>
        </div>
      </div>

    </div>
  );
}