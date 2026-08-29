import './globals.css';
import ConditionalHeader from '@/components/ConditionalHeader';
import { createClient } from '@/utils/supabase/server'; 
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/ThemeProvider';
import Sidebar from '@/components/chrome/Sidebar';

export const metadata = {
  title: 'TRON V3 Dashboard',
  description: 'Command center for TRON PM automations',
};

export default async function RootLayout({ children }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  let isAdmin = false;
  let currentOrg = null;

  if (user) {
      const { data: orgMembers } = await supabase.from('organization_members')
        .select(`
          role,
          organizations (id, name)
        `)
        .eq('user_id', user.id)
        .limit(1);
        
      isAdmin = orgMembers?.[0]?.role === 'admin';
      currentOrg = orgMembers?.[0]?.organizations;
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-chrome-bg text-gray-900 min-h-screen">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="flex min-h-screen">
            <ConditionalHeader>
              <Sidebar currentOrg={currentOrg} />
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