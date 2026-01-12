'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

// Dynamically import the terminal component to avoid SSR issues
const TerminalComponent = dynamic(() => import('./Terminal'), {
  ssr: false,
  loading: () => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: '#1a1a2e',
      color: '#fff'
    }}>
      Loading terminal...
    </div>
  ),
})

export default function TerminalPage() {
  const params = useParams()
  const host = params.host as string

  return <TerminalComponent host={host} />
}
