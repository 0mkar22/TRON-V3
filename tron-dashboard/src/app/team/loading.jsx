export default function TeamLoading() {
    return (
        <div className="max-w-4xl mx-auto p-6 lg:p-8 font-sans w-full animate-pulse">
            <div className="mb-10">
                <div className="h-8 bg-gray-200 rounded-lg w-64 mb-2"></div>
                <div className="h-4 bg-gray-100 rounded-lg w-80"></div>
            </div>

            <div className="space-y-6">
                {/* Invite Card */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm h-48">
                    <div className="h-6 bg-gray-200 rounded-md w-48 mb-6"></div>
                    <div className="h-12 bg-gray-100 rounded-xl w-full mb-4"></div>
                    <div className="h-10 bg-indigo-100 rounded-xl w-32"></div>
                </div>

                {/* Assign Workflow Card */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm h-56">
                    <div className="h-6 bg-gray-200 rounded-md w-40 mb-6"></div>
                    <div className="flex gap-4 mb-4">
                        <div className="h-12 bg-gray-100 rounded-xl w-1/2"></div>
                        <div className="h-12 bg-gray-100 rounded-xl w-1/2"></div>
                    </div>
                    <div className="h-10 bg-indigo-100 rounded-xl w-32"></div>
                </div>

                {/* Active Assignments List */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm h-32 flex flex-col justify-center items-center">
                     <div className="h-6 bg-gray-200 rounded-md w-56 mb-4 self-start"></div>
                     <div className="h-4 bg-gray-100 rounded-md w-64"></div>
                </div>

                 {/* Active Team Members List */}
                 <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <div className="h-6 bg-gray-200 rounded-md w-48 mb-6"></div>
                    {[1, 2].map(i => (
                        <div key={i} className="flex items-center justify-between py-4 border-t border-gray-50">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
                                <div>
                                    <div className="h-4 bg-gray-200 rounded-md w-32 mb-1"></div>
                                    <div className="h-3 bg-gray-100 rounded-md w-48"></div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <div className="h-6 w-16 bg-gray-100 rounded-lg"></div>
                                <div className="h-6 w-16 bg-green-50 rounded-lg"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}