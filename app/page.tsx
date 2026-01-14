'use client'

import dynamic from 'next/dynamic'
import HomeScreen from './HomeScreen'

const AppShell = dynamic(() => import('./AppShell'), {
  ssr: false,
  loading: () => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100dvh',
      background: '#1a1a2e',
      color: '#888',
    }}>
      Loading...
    </div>
  ),
})

export default function Home() {
  return (
    <AppShell homeContent={<HomeScreen />} />
  )
}
