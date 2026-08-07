export default function Loading() {
    return (
        <div className="max-w-6xl mx-auto p-6 lg:p-8 font-sans w-full animate-pulse">
            {/* Header Skeleton */}
            <div className="mb-10">
                <div className="h-8 bg-gray-200 rounded-lg w-64 mb-4"></div>
                <div className="h-4 bg-gray-100 rounded-lg w-96"></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Side (Form Area) Skeleton */}
                <div className="lg:col-span-7">
                    <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden">
                        <div className="p-6 sm:p-8 border-b border-gray-100 bg-gray-50/50">
                            <div className="h-6 bg-gray-200 rounded w-40 mb-2"></div>
                            <div className="h-3 bg-gray-100 rounded w-64"></div>
                        </div>
                        <div className="p-6 sm:p-8 space-y-8">
                            {/* Input Skeletons */}
                            <div className="space-y-4">
                                <div className="h-4 bg-gray-200 rounded w-32"></div>
                                <div className="h-12 bg-gray-100 rounded-xl w-full"></div>
                            </div>
                            <div className="space-y-4">
                                <div className="h-4 bg-gray-200 rounded w-32"></div>
                                <div className="h-12 bg-gray-100 rounded-xl w-full"></div>
                            </div>
                            <div className="h-12 bg-indigo-100 rounded-xl w-full mt-4"></div>
                        </div>
                    </div>
                </div>

                {/* Right Side (Active Mappings) Skeleton */}
                <div className="lg:col-span-5">
                    <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden h-full">
                        <div className="p-6 sm:p-8 border-b border-gray-100 bg-gray-50/50">
                            <div className="h-6 bg-gray-200 rounded w-40 mb-2"></div>
                            <div className="h-3 bg-gray-100 rounded w-56"></div>
                        </div>
                        
                        <div className="p-6 sm:p-8 space-y-4">
                            {/* Card Skeletons */}
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-4">
                                    <div className="flex items-center space-x-3 border-b border-gray-50 pb-3">
                                        <div className="h-6 w-6 bg-gray-200 rounded-full"></div>
                                        <div className="h-5 bg-gray-200 rounded w-32"></div>
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="h-6 bg-gray-100 rounded-lg w-24"></div>
                                        <div className="h-6 bg-gray-100 rounded-lg w-20"></div>
                                    </div>
                                    <div className="h-8 bg-red-50 rounded-lg w-full mt-1"></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}