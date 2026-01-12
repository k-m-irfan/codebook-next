import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Codebook - SSH Manager',
  description: 'Manage your SSH hosts and sessions',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
