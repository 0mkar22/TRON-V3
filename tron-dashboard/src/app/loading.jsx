export default function DashboardHomeLoading() {
    return (
        <div className="max-w-6xl mx-auto p-6 lg:p-8 font-sans w-full animate-pulse">
            
            {/* Welcome Banner Skeleton */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 mb-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 flex justify-between items-start">
                <div>
                    <div className="h-6 w-24 bg-gray-200 rounded-md mb-4"></div>
                    <div className="h-10 w-64 bg-gray-200 rounded-xl mb-3"></div>
                    <div className="h-5 w-48 bg-gray-100 rounded-md mb-6"></div>
                    <div className="h-4 w-96 bg-gray-100 rounded-md"></div>
                </div>
                <div className="h-10 w-32 bg-green-50 rounded-xl"></div>
            </div>

            {/* Three Cards Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-48 flex flex-col justify-between">
                        <div>
                            <div className="h-10 w-10 bg-gray-100 rounded-xl mb-4"></div>
                            <div className="h-6 w-32 bg-gray-200 rounded-md mb-2"></div>
                            <div className="h-12 w-full bg-gray-100 rounded-md"></div>
                        </div>
                        <div className="h-4 w-24 bg-gray-200 rounded-md"></div>
                    </div>
                ))}
            </div>

            {/* Active Workflows List Skeleton */}
            <div className="mb-6 flex justify-between items-center">
                <div className="h-6 w-40 bg-gray-200 rounded-md"></div>
                <div className="h-4 w-32 bg-gray-200 rounded-md"></div>
            </div>
            
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50 flex gap-4">
                     <div className="h-3 w-1/4 bg-gray-200 rounded"></div>
                     <div className="h-3 w-1/4 bg-gray-200 rounded"></div>
                     <div className="h-3 w-1/4 bg-gray-200 rounded"></div>
                </div>
                {[1, 2].map(i => (
                    <div key={i} className="px-6 py-5 border-b border-gray-50 flex items-center justify-between">
                        <div className="flex items-center gap-3 w-1/4">
                            <div className="h-6 w-6 bg-gray-200 rounded-full"></div>
                            <div className="h-4 w-32 bg-gray-200 rounded-md"></div>
                        </div>
                        <div className="h-6 w-24 bg-gray-100 rounded-lg w-1/4"></div>
                        <div className="h-6 w-24 bg-gray-100 rounded-lg w-1/4"></div>
                        <div className="h-6 w-16 bg-green-50 rounded-lg"></div>
                    </div>
                ))}
            </div>
        </div>
    );
}