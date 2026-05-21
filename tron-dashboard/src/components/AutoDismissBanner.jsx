'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function AutoDismissBanner({ title, duration = 4000 }) {
    const [visible, setVisible] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // Start the countdown timer
        const timer = setTimeout(() => {
            setVisible(false);
            // Clean the query parameters from the URL without reloading the page
            router.replace(pathname, { scroll: false });
        }, duration);

        // Cleanup the timer if the user navigates away early
        return () => clearTimeout(timer);
    }, [router, pathname, duration]);

    if (!visible) return null;

    return (
        <div className="bg-green-50 border-l-4 border-green-600 p-5 mb-8 rounded-r-xl shadow-sm transition-all duration-500 animate-in fade-in slide-in-from-top-4">
            <h3 className="text-green-900 font-bold text-lg flex items-center">
                <span className="mr-2">✅</span> {title}
            </h3>
        </div>
    );
}