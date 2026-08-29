import LiveTerminal from '@/components/maximalist/LiveTerminal';

export default function MissionControlPage() {
  return (
    <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
      
      <header className="flex justify-between items-end border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Mission Control</h1>
          <p className="text-sm text-gray-500 mt-1">Observability and Orchestration Engine</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="col-span-2 space-y-8">
          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Telemetry
            </h2>
            <LiveTerminal initialLogs={[
              { timestamp: new Date().toISOString(), type: 'info', message: 'Mission Control initialized.' },
              { timestamp: new Date().toISOString(), type: 'info', message: 'Connected to TRON_V3 orchestration engine.' },
              { timestamp: new Date().toISOString(), type: 'info', message: 'Waiting for webhook events...' },
            ]} />
          </section>
        </div>

        <div className="space-y-8">
          <section className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">System Status</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Event Queue</span>
                <span className="font-mono text-lg text-gray-900">0</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Go Workers</span>
                <span className="font-mono text-sm text-emerald-600 font-medium">Healthy</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
