'use client';
import { useEffect, useRef, useState } from 'react';

export default function LiveTerminal({ initialLogs = [] }) {
  const [logs, setLogs] = useState(initialLogs);
  const endRef = useRef(null);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="flex flex-col h-96 bg-terminal-bg rounded-lg border border-gray-800 shadow-inner overflow-hidden">
      <div className="px-4 py-2 bg-gray-900 border-b border-gray-800 flex items-center justify-between">
        <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">Go Worker Telemetry</span>
        <div className="flex gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500" /><div className="w-2.5 h-2.5 rounded-full bg-yellow-500" /><div className="w-2.5 h-2.5 rounded-full bg-green-500" /></div>
      </div>
      <div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-terminal-text space-y-1">
        {logs.map((log, i) => (
          <div key={i} className="flex gap-4 hover:bg-white/5 px-1 rounded">
            <span className="text-gray-500 shrink-0">[{log.timestamp}]</span>
            <span className={`${log.type === 'error' ? 'text-red-400' : 'text-terminal-text'}`}>{log.message}</span>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-gray-500">Waiting for events...</div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
