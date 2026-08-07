export default function IntegrationsLoading() {
    return (
        <div className="max-w-6xl mx-auto p-6 lg:p-8 font-sans w-full animate-pulse">
            <div className="mb-10">
                <div className="h-8 bg-gray-200 rounded-lg w-48 mb-2"></div>
                <div className="h-4 bg-gray-100 rounded-lg w-72"></div>
            </div>

            {/* Version Control Section */}
            <div className="mb-10">
                <div className="h-5 bg-gray-200 rounded-md w-32 mb-4"></div>
                <div className="bg-white rounded-2xl p-6 border border-gray-200 max-w-md h-40"></div>
            </div>

            {/* Project Management Section */}
            <div className="mb-10">
                <div className="h-5 bg-gray-200 rounded-md w-40 mb-4"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
                    <div className="bg-white rounded-2xl p-6 border border-gray-200 h-40"></div>
                    <div className="bg-white rounded-2xl p-6 border border-gray-200 h-40"></div>
                    <div className="bg-white rounded-2xl p-6 border border-gray-200 h-40 max-w-md"></div>
                </div>
            </div>

            {/* Communication Section */}
            <div>
                <div className="h-5 bg-gray-200 rounded-md w-36 mb-4"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
                    <div className="bg-white rounded-2xl p-6 border border-gray-200 h-40"></div>
                    <div className="bg-white rounded-2xl p-6 border border-gray-200 h-40"></div>
                </div>
            </div>
        </div>
    );
}