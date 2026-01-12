import { NextResponse } from 'next/server';
import { parseSSHConfig } from '@/lib/ssh-parser';

export async function GET() {
  try {
    const hosts = parseSSHConfig();
    return NextResponse.json({ hosts });
  } catch (error) {
    return NextResponse.json({ hosts: [], error: 'Failed to read SSH config' }, { status: 500 });
  }
}
