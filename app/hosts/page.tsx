'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface SSHHost {
  name: string;
  hostname?: string;
  user?: string;
}

export default function HostsPage() {
  const [hosts, setHosts] = useState<SSHHost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/hosts')
      .then(res => res.json())
      .then(data => {
        setHosts(data.hosts || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching hosts:', err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center mb-8">
          <Link href="/" className="text-blue-600 hover:text-blue-700 mr-4">
            ← Back
          </Link>
          <h1 className="text-4xl font-bold text-gray-900">Hosts</h1>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-gray-800">Your Machines</h2>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition">
              + Add Host
            </button>
          </div>
          
          <div className="space-y-2">
            {/* Local Machine */}
            <Link href="/terminal/local">
              <div className="border border-gray-200 rounded-md p-4 hover:bg-gray-50 cursor-pointer transition">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
                    <span className="text-green-600 text-lg">💻</span>
                  </div>
                  <h3 className="font-medium text-gray-900">Local Machine</h3>
                </div>
              </div>
            </Link>

            {/* Remote Hosts */}
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading hosts...</div>
            ) : hosts.length > 0 ? (
              hosts.map((host) => (
                <Link key={host.name} href={`/terminal/${encodeURIComponent(host.name)}`}>
                  <div className="border border-gray-200 rounded-md p-4 hover:bg-gray-50 cursor-pointer transition">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                        <span className="text-blue-600 text-lg">🖥️</span>
                      </div>
                      <h3 className="font-medium text-gray-900">{host.name}</h3>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">No remote hosts found</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
