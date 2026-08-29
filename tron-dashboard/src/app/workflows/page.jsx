import WorkflowDataTable from '@/components/maximalist/WorkflowDataTable';
import { createClient } from '@/utils/supabase/server';

export default async function OrchestratorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  let workflows = [];
  if (user) {
    const { data: orgMembers } = await supabase.from('organization_members').select('org_id').eq('user_id', user.id).limit(1);
    const orgId = orgMembers?.[0]?.org_id;

    if (orgId) {
      const { data } = await supabase.from('repositories').select('*').eq('org_id', orgId);
      workflows = data || [];
    }
  }

  return (
    <div className="max-w-7xl mx-auto p-6 lg:p-8 space-y-8">
      <header className="border-b border-gray-200 pb-4">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Orchestrator</h1>
        <p className="text-sm text-gray-500 mt-1">Workflow mapping and routing</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 border-r border-gray-100 pr-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Mapping</h2>
          <form className="space-y-4">
             <div className="space-y-1">
               <label className="text-xs font-semibold text-gray-700">Select Repository</label>
               <select className="w-full border border-gray-300 rounded p-2 text-sm bg-gray-50">
                 <option>Select a repository...</option>
               </select>
             </div>
             <div className="space-y-1">
               <label className="text-xs font-semibold text-gray-700">Project Management Target</label>
               <select className="w-full border border-gray-300 rounded p-2 text-sm bg-gray-50">
                 <option>Jira Project...</option>
               </select>
             </div>
             <button type="button" className="w-full bg-gray-900 text-white font-medium py-2 rounded text-sm hover:bg-gray-800 transition-colors">
               Save Mapping
             </button>
          </form>
        </div>
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Workflows</h2>
          <WorkflowDataTable mappings={workflows} />
        </div>
      </div>
    </div>
  );
}
