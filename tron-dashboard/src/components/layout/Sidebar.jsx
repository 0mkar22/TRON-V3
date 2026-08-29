"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import OrganizationSwitcher from "./OrganizationSwitcher";

export default function Sidebar({ isAdmin }) {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Dashboard" },
    ...(isAdmin ? [
      { href: "/integrations", label: "Integrations" },
      { href: "/repositories", label: "Workflow Mapping" },
      { href: "/team", label: "Team Management" },
    ] : []),
    { href: "/activity", label: "Activity Log" },
  ];

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col min-h-screen">
      <div className="p-4 flex items-center space-x-3 border-b border-gray-800">
        <Image src="/logo.png" alt="Organization Logo" width={40} height={40} className="bg-white rounded-full p-1" />
        <span className="font-bold text-xl tracking-wider">T.R.O.N.</span>
      </div>

      <div className="border-b border-gray-800 py-2">
        <OrganizationSwitcher />
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`block px-3 py-2 rounded-md text-sm font-medium ${
              pathname === link.href
                ? "bg-gray-800 text-white"
                : "text-gray-300 hover:bg-gray-700 hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
