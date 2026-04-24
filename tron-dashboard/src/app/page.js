export default function Home() {
  return (
    <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-100">
      <h1 className="text-3xl font-bold text-gray-800 mb-4">System Overview</h1>
      <p className="text-gray-600 mb-6">
        Welcome to the TRON V3 Dashboard. Your event-driven backend is running smoothly. 
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        {/* Quick Stat Cards */}
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-700">Active Repositories</h3>
          <p className="text-4xl font-bold text-green-600 mt-2">1</p>
        </div>
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-700">Integrations</h3>
          <p className="text-4xl font-bold text-green-600 mt-2">2</p>
        </div>
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-700">Events Processed</h3>
          <p className="text-4xl font-bold text-green-600 mt-2">--</p>
        </div>
      </div>
    </div>
  );
}