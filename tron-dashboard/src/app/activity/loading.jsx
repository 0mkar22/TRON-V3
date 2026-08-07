export default function MissionControlLoading() {
    return (
        <div className="max-w-6xl mx-auto p-6 lg:p-8 font-sans w-full animate-pulse">
            <div className="mb-10 flex items-center gap-3">
                <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
                <div>
                    <div className="h-8 bg-gray-200 rounded-lg w-56 mb-2"></div>
                    <div className="h-4 bg-gray-100 rounded-lg w-96"></div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Active Event Queue */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm h-64">
                    <div className="flex justify-between items-center mb-6">
                        <div className="h-6 bg-gray-200 rounded-md w-48"></div>
                        <div className="h-8 w-20 bg-blue-50 rounded-xl"></div>
                    </div>
                    <div className="h-32 w-full border border-dashed border-gray-200 rounded-xl bg-gray-50/50 flex items-center justify-center">
                        <div className="h-4 bg-gray-200 rounded-md w-48"></div>
                    </div>
                </div>

                {/* AI Review Cache */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm h-64">
                     <div className="flex justify-between items-center mb-6">
                        <div className="h-6 bg-gray-200 rounded-md w-40"></div>
                        <div className="h-8 w-20 bg-green-50 rounded-xl"></div>
                    </div>
                    <div className="h-32 w-full border border-dashed border-gray-200 rounded-xl bg-gray-50/50 flex items-center justify-center">
                         <div className="h-4 bg-gray-200 rounded-md w-56"></div>
                    </div>
                </div>
            </div>
        </div>
    );
}