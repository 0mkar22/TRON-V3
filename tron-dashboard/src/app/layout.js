import './globals.css';
import ConditionalHeader from '@/components/ConditionalHeader';
import { createClient } from '@/utils/supabase/server'; 
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/ThemeProvider';
import Sidebar from '@/components/layout/Sidebar';

export const metadata = {
  title: 'TRON V3 Dashboard',
  description: 'Command center for TRON PM automations',
};

export default async function RootLayout({ children }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  let isAdmin = false;
  if (user) {
      const { data: orgMembers } = await supabase.from('organization_members').select('role').eq('user_id', user.id).limit(1);
      isAdmin = orgMembers?.[0]?.role === 'admin';
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="flex min-h-screen">
            <ConditionalHeader>
              <Sidebar isAdmin={isAdmin} />
            </ConditionalHeader>

            <main className="flex-grow w-full overflow-y-auto bg-gray-50 dark:bg-gray-800">
              {children}
            </main>
          </div>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}