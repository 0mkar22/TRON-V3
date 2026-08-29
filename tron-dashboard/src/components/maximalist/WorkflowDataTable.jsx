export default function WorkflowDataTable({ mappings = [] }) {
  return (
    <div className="w-full overflow-x-auto border border-gray-200 rounded-sm">
      <table className="w-full text-left text-sm text-gray-600">
        <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-3 py-2 font-semibold">Repository</th>
            <th className="px-3 py-2 font-semibold">PM Target</th>
            <th className="px-3 py-2 font-semibold">Sync Status</th>
            <th className="px-3 py-2 font-semibold text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {mappings.map(map => (
            <tr key={map.id} className="hover:bg-gray-50/50 transition-colors">
              <td className="px-3 py-1.5 font-medium text-gray-900 flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-green-500"/>{map.repo_name}
              </td>
              <td className="px-3 py-1.5 font-mono text-xs bg-gray-50 rounded">{map.pm_project_id}</td>
              <td className="px-3 py-1.5"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">ACTIVE</span></td>
              <td className="px-3 py-1.5 text-right font-mono text-xs text-blue-600 cursor-pointer">EDIT</td>
            </tr>
          ))}
          {mappings.length === 0 && (
            <tr>
              <td colSpan="4" className="px-3 py-4 text-center text-gray-400">
                No workflow mappings found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
