export default function GlobalLoading() {
    return (
        <div className="max-w-6xl mx-auto p-6 lg:p-8 font-sans w-full animate-pulse flex flex-col min-h-[60vh]">
            
            {/* Generic Header Skeleton */}
            <div className="mb-10">
                <div className="h-10 bg-gray-200 rounded-xl w-48 mb-4"></div>
                <div className="h-5 bg-gray-100 rounded-lg w-72"></div>
            </div>

            {/* Generic Content Area Skeleton */}
            <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-6 sm:p-8 flex-1">
                
                {/* Simulated Toolbar/Filter Area */}
                <div className="flex gap-4 mb-8 border-b border-gray-50 pb-6">
                    <div className="h-10 bg-gray-100 rounded-xl w-1/4"></div>
                    <div className="h-10 bg-gray-100 rounded-xl w-1/4"></div>
                    <div className="h-10 bg-gray-100 rounded-xl w-24 ml-auto"></div>
                </div>

                {/* Simulated List/Grid Content */}
                <div className="space-y-6">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center gap-4 w-full">
                            <div className="h-12 w-12 bg-gray-100 rounded-full shrink-0"></div>
                            <div className="flex flex-col gap-2 w-full">
                                <div className="h-4 bg-gray-200 rounded-md w-1/3"></div>
                                <div className="h-3 bg-gray-100 rounded-md w-2/3"></div>
                            </div>
                        </div>
                    ))}
                </div>

            </div>
        </div>
    );
}