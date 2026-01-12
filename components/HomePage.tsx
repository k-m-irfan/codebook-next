'use client';

import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-gray-900">Codebook</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Hosts Section */}
          <Link href="/hosts">
            <div className="bg-white rounded-lg shadow p-12 hover:shadow-lg cursor-pointer transition-all hover:scale-105">
              <div className="text-center">
                <div className="text-6xl mb-4">🖥️</div>
                <h2 className="text-3xl font-semibold text-gray-800 mb-2">Hosts</h2>
                <p className="text-gray-600">Manage your local and remote machines</p>
              </div>
            </div>
          </Link>

          {/* Active Sessions Section */}
          <div className="bg-white rounded-lg shadow p-12 hover:shadow-lg cursor-pointer transition-all hover:scale-105 opacity-50">
            <div className="text-center">
              <div className="text-6xl mb-4">📋</div>
              <h2 className="text-3xl font-semibold text-gray-800 mb-2">Active Sessions</h2>
              <p className="text-gray-600">View and manage active connections</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
