"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export default function LiveTerminal() {
    // We start empty to prevent the hydration error
    /** @type {React.MutableRefObject<any[]> | any} */
    const [logs, setLogs] = useState([]);
    
    const terminalEndRef = useRef(null);

    // Auto-scroll to the bottom whenever a new log arrives
    useEffect(() => {
        terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    useEffect(() => {
        // Inject the initial log only AFTER the component mounts on the client
        setLogs([{ 
            id: 'init',
            time: new Date().toLocaleTimeString('en-US', { hour12: false }), 
            source: 'System', 
            message: 'TRON Engine initialized. Connecting to live stream...', 
            color: 'text-emerald-400' 
        }]);

        // Connect to your Render backend's SSE endpoint
        const API_URL = 'https://tron-v3.onrender.com/api/logs/stream';

        const eventSource = new EventSource(API_URL);

        eventSource.onmessage = (event) => {
            const newLog = JSON.parse(event.data);
            
            // 🌟 THE FIX: Override the server's UTC time with the developer's local browser time
            newLog.time = new Date().toLocaleTimeString('en-US', { hour12: false });
            
            // Add the new log to the feed, keeping only the last 50
            setLogs(prevLogs => {
                const updated = [...prevLogs, newLog];
                return updated.slice(-50); 
            });
        };

        eventSource.onerror = () => {
            console.error("Lost connection to log stream. Reconnecting...");
        };

        // Cleanup the connection if the user navigates away
        return () => eventSource.close();
    }, []);

    return (
        <div className="bg-[#0D1117] rounded-2xl shadow-xl border border-gray-800 overflow-hidden h-full flex flex-col font-mono">
            {/* Mac-style Terminal Header */}
            <div className="px-4 py-3 bg-[#161B22] border-b border-gray-800 flex items-center justify-between">
                <div className="flex space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                </div>
                <span className="text-xs text-gray-500 font-bold tracking-widest uppercase">Live Activity</span>
                <div className="w-12"></div>
            </div>
            
            {/* Live Logs Feed */}
            <div className="p-5 text-sm space-y-4 flex-grow overflow-y-auto h-80">
                {logs.map((log, index) => (
                    <div key={log.id || index} className={log.color || 'text-gray-300'}>
                        <span className="text-gray-500 mr-3">{log.time}</span>
                        <span className="font-bold mr-2">[{log.source}]</span>
                        {log.message}
                    </div>
                ))}
                
                {/* Auto-scroll anchor */}
                <div ref={terminalEndRef} />
                
                <div className="text-emerald-400 flex items-center mt-6 opacity-70">
                    <span className="animate-pulse mr-2">█</span> Awaiting next event...
                </div>
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-gray-800 bg-[#161B22] text-center">
                <Link href="/activity" className="text-xs text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-wider transition-colors">
                    Open Full Mission Control ➔
                </Link>
            </div>
        </div>
    );
}