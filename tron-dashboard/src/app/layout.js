import './globals.css';
import Link from 'next/link';
import Image from 'next/image';
import ConditionalHeader from '@/components/ConditionalHeader';
import { createClient } from '@/utils/supabase/server'; // 🌟 NEW: Added server client

export const metadata = {
  title: 'TRON V3 Dashboard',
  description: 'Command center for TRON PM automations',
};

export default async function RootLayout({ children }) {
  // 🌟 NEW: Fetch the user's role securely on the server
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  let isAdmin = false;
  if (user) {
      const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
      isAdmin = userData?.role === 'admin';
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-gray-50 min-h-screen flex flex-col text-gray-900">
        
        <ConditionalHeader>
            <header className="bg-green-600 text-white shadow-md">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                  
                  {/* Branding */}
                  <div className="flex items-center space-x-3">
                    <Image src="/logo.png" alt="Organization Logo" width={40} height={40} className="bg-white rounded-full p-1" />
                    <span className="font-bold text-xl tracking-wider">T.R.O.N.</span>
                  </div>

                  {/* Navigation Links */}
                  <nav className="flex space-x-8">
                    <Link href="/" className="hover:text-green-200 transition-colors font-medium">
                      Dashboard
                    </Link>
                    
                    {/* 🌟 THE BOUNCER: Only render these if they are an admin! */}
                    {isAdmin && (
                      <>
                        <Link href="/integrations" className="hover:text-green-200 transition-colors font-medium">Integrations</Link>
                        <Link href="/repositories" className="hover:text-green-200 transition-colors font-medium">Workflow Mapping</Link>
                        <Link href="/team" className="hover:text-green-200 transition-colors font-medium">Team Management</Link>
                      </>
                    )}
                    
                    <Link href="/activity" className="hover:text-green-200 transition-colors font-medium">
                      Activity Log
                    </Link>
                  </nav>

                </div>
              </div>
            </header>
        </ConditionalHeader>

        <main className="flex-grow w-full">
          {children}
        </main>

      </body>
    </html>
  );
}