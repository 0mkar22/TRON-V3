"use client";
/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

import { useState, useEffect } from "react";
import Cookies from "js-cookie";

export default function OrganizationSwitcher() {
  const [workspaces, setWorkspaces] = useState([
    { id: "org-1", name: "Acme Corp" },
    { id: "org-2", name: "Stark Industries" },
  ]);
  const [selectedWorkspace, setSelectedWorkspace] = useState("");

  useEffect(() => {
    const savedOrg = Cookies.get("X-Org-ID") || workspaces[0].id;
    setSelectedWorkspace(savedOrg);
    if (!Cookies.get("X-Org-ID")) {
      Cookies.set("X-Org-ID", savedOrg, { path: "/" });
    }
  }, []);

  const handleChange = (e) => {
    const newOrgId = e.target.value;
    setSelectedWorkspace(newOrgId);
    Cookies.set("X-Org-ID", newOrgId, { path: "/" });
    // Reload the page to reflect data for the new org
    window.location.reload();
  };

  if (!selectedWorkspace) return null;

  return (
    <div className="px-4 py-2">
      <label htmlFor="workspace-switcher" className="block text-sm font-medium text-gray-400 mb-1">
        Workspace
      </label>
      <select
        id="workspace-switcher"
        value={selectedWorkspace}
        onChange={handleChange}
        className="block w-full bg-gray-800 text-white border-gray-700 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
      >
        {workspaces.map((ws) => (
          <option key={ws.id} value={ws.id}>
            {ws.name}
          </option>
        ))}
      </select>
    </div>
  );
}
