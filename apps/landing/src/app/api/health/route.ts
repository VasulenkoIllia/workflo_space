import { NextResponse } from 'next/server'

export function GET() {
  return NextResponse.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    version: process.env.npm_package_version ?? '0.1.0',
    timestamp: new Date().toISOString(),
  })
}
