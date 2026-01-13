import { NextResponse } from 'next/server'
import { parseSSHConfig, addSSHHost, updateSSHHost, deleteSSHHost } from '@/lib/ssh-parser'

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

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { oldName, name, hostname, user, port } = body

    if (!oldName || !name) {
      return NextResponse.json({ error: 'Host name is required' }, { status: 400 })
    }

    // Sanitize values - trim and remove any stray encoding artifacts
    const sanitizedName = String(name || '').trim()
    const sanitizedHostname = hostname ? String(hostname).trim() : ''
    const sanitizedUser = user ? String(user).trim() : ''
    const sanitizedPort = port ? String(port).trim() : ''

    // Check if new name conflicts with existing host (unless it's the same host)
    if (oldName !== sanitizedName) {
      const existingHosts = parseSSHConfig()
      if (existingHosts.some(h => h.name === sanitizedName)) {
        return NextResponse.json({ error: 'Host with this name already exists' }, { status: 400 })
      }
    }

    updateSSHHost(oldName, {
      name: sanitizedName,
      hostname: sanitizedHostname,
      user: sanitizedUser,
      port: sanitizedPort
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to update host:', error)
    return NextResponse.json({ error: 'Failed to update host' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const name = searchParams.get('name')

    if (!name) {
      return NextResponse.json({ error: 'Host name is required' }, { status: 400 })
    }

    deleteSSHHost(name)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete host:', error)
    return NextResponse.json({ error: 'Failed to delete host' }, { status: 500 })
  }
}
