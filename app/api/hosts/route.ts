import { NextResponse } from 'next/server'
import { parseSSHConfig } from '@/lib/ssh-parser'

export async function GET() {
  const hosts = parseSSHConfig()
  return NextResponse.json(hosts)
}
