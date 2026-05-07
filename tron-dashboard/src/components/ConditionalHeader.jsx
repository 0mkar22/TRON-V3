"use client";

import { usePathname } from 'next/navigation';

export default function ConditionalHeader({ children }) {
    const pathname = usePathname();

    // The "Blacklist": Hide the header if the URL starts with any of these paths
    if (
        pathname.startsWith('/login') || 
        pathname.startsWith('/signup') || 
        pathname.startsWith('/onboarding')
    ) {
        return null; // Render nothing!
    }

    // Otherwise, render the green header normally
    return children;
}