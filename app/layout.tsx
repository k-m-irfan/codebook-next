import './globals.css'

export const metadata = {
  title: 'Codebook',
  description: 'SSH Host Manager',
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
