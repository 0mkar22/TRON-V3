import './globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'TRON V3 Dashboard',
  description: 'Command center for TRON PM automations',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen flex flex-col text-gray-900">
        
        {/* Navigation Header */}
        <header className="bg-green-600 text-white shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              
              {/* Branding */}
              <div className="flex items-center space-x-3">
                <img 
                  src="/logo.png" 
                  alt="Organization Logo" 
                  className="h-10 w-10 bg-white rounded-full p-1"
                />
                <span className="font-bold text-xl tracking-wider">T.R.O.N.</span>
              </div>

              {/* Navigation Links */}
              <nav className="flex space-x-8">
                <Link href="/" className="hover:text-green-200 transition-colors">
                  Dashboard
                </Link>
                <Link href="/integrations" className="hover:text-green-200 transition-colors">
                  Integrations
                </Link>
                <Link href="/repositories" className="hover:text-green-200 transition-colors">
                  Repositories
                </Link>
              </nav>

            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
          {children}
        </main>

      </body>
    </html>
  );
}