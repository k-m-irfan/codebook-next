import { NextResponse } from 'next/server'
import { parseSSHConfig, addSSHHost } from '@/lib/ssh-parser'

export async function GET() {
  const hosts = parseSSHConfig()
  return NextResponse.json(hosts)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, hostname, user, port } = body

    if (!name) {
      return NextResponse.json({ error: 'Host name is required' }, { status: 400 })
    }

    // Check if host already exists
    const existingHosts = parseSSHConfig()
    if (existingHosts.some(h => h.name === name)) {
      return NextResponse.json({ error: 'Host with this name already exists' }, { status: 400 })
    }

    addSSHHost({ name, hostname, user, port })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to add host:', error)
    return NextResponse.json({ error: 'Failed to add host' }, { status: 500 })
  }
}
