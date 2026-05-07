"use client";

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function SetPasswordPage() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [status, setStatus] = useState({ type: '', message: '' });
    const [loading, setLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const supabase = createClient();

    const handleSetPassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatus({ type: '', message: '' });

        if (password !== confirmPassword) {
            setStatus({ type: 'error', message: "Passwords do not match." });
            setLoading(false);
            return;
        }

        if (password.length < 6) {
            setStatus({ type: 'error', message: "Password must be at least 6 characters." });
            setLoading(false);
            return;
        }

        try {
            // Because the email link auto-logged them in, we just update their account!
            const { error } = await supabase.auth.updateUser({
                password: password
            });

            if (error) throw error;

            setIsSuccess(true);
        } catch (error) {
            setStatus({ 
                type: 'error', 
                message: error.message || "Failed to set password. Your link may have expired." 
            });
        } finally {
            setLoading(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
                <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                    <div className="text-5xl mb-4">🎉</div>
                    <h2 className="text-3xl font-extrabold text-gray-900 mb-2">You&apos;re all set!</h2>
                    <p className="text-gray-600 mb-8">Your account is fully activated.</p>
                    
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-left">
                        <h3 className="font-bold text-blue-900 mb-2">Next Steps:</h3>
                        <ol className="list-decimal ml-5 text-blue-800 space-y-2">
                            <li>Open your VS Code.</li>
                            <li>Press <strong>F1</strong> to open the command palette.</li>
                            <li>Type <strong>T.R.O.N: Sign In</strong>.</li>
                            <li>Log in with your email and this new password.</li>
                        </ol>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                    Welcome to T.R.O.N.
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    Set your developer password to activate your account.
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-200">
                    <form className="space-y-6" onSubmit={handleSetPassword}>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                New Password
                            </label>
                            <div className="mt-1">
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Confirm Password
                            </label>
                            <div className="mt-1">
                                <input
                                    type="password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                />
                            </div>
                        </div>

                        {status.message && (
                            <div className={`p-3 rounded-md text-sm ${
                                status.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : ''
                            }`}>
                                {status.message}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !password || !confirmPassword}
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                            {loading ? 'Activating...' : 'Set Password & Activate'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}