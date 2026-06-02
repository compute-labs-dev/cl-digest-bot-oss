import { NextResponse } from 'next/server';

export const AGENT_API_TOKEN_ENV = 'AGENT_API_TOKEN';

export function hasAgentAuthorization(request: Request): boolean {
  const agentToken = process.env[AGENT_API_TOKEN_ENV];
  const authHeader = request.headers.get('authorization');

  return Boolean(agentToken && authHeader === `Bearer ${agentToken}`);
}

export function requireAgentAuthorization(request: Request): NextResponse | null {
  if (hasAgentAuthorization(request)) {
    return null;
  }

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
