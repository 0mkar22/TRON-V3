'use client';

import { useEffect, useRef } from 'react';

export default function GithubAutoSetup({ action, installationId }) {
    const formRef = useRef(null);

    useEffect(() => {
        if (formRef.current) {
            // This is the magic robot! It instantly submits the form as soon as the page loads.
            formRef.current.requestSubmit();
        }
    }, []);

    return (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-6 mb-8 rounded-r-xl shadow-sm flex items-center animate-pulse">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-4"></div>
            <div>
                <h3 className="text-blue-900 font-bold text-lg">Finalizing Connection...</h3>
                <p className="text-blue-700 text-sm mt-1">Securing GitHub App credentials. Please wait.</p>
            </div>
            {/* The hidden form that triggers your secure Server Action */}
            <form action={action} ref={formRef} className="hidden">
                <input type="hidden" name="installationId" value={installationId} />
            </form>
        </div>
    );
}