"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const [workspaceName, setWorkspaceName] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    setLoading(true);
    // Mocking an API call to create a workspace
    setTimeout(() => {
      setLoading(false);
      // In a real app, you would save the returned org ID, perhaps update the user's default org
      // and redirect to the dashboard
      router.push("/");
    }, 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 p-10 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Welcome to TRON
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Let&apos;s get started by creating your first workspace.
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleCreateWorkspace}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="workspace-name" className="sr-only">
                Workspace Name
              </label>
              <input
                id="workspace-name"
                name="workspace-name"
                type="text"
                required
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm"
                placeholder="E.g., Stark Industries"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 transition-colors"
            >
              {loading ? "Creating..." : "Create Workspace"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
