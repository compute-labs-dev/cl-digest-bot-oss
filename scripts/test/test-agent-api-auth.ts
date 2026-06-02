import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  AGENT_API_TOKEN_ENV,
  hasAgentAuthorization,
  requireAgentAuthorization,
} from '../../lib/api/agent-auth';

function assertGuardBeforeBodyParsing(routePath: string) {
  const source = fs.readFileSync(path.join(process.cwd(), routePath), 'utf8');
  const guardIndex = source.indexOf('requireAgentAuthorization(request)');
  const bodyIndex = source.indexOf('request.json()');

  assert.ok(guardIndex >= 0, `${routePath} must require agent authorization`);
  assert.ok(bodyIndex >= 0, `${routePath} must parse the request body`);
  assert.ok(guardIndex < bodyIndex, `${routePath} must authorize before parsing the body`);
}

async function main() {
  const originalToken = process.env[AGENT_API_TOKEN_ENV];

  try {
    delete process.env[AGENT_API_TOKEN_ENV];

    const missingTokenRequest = new Request('https://example.com/api/agent/chat', {
      method: 'POST',
      headers: { authorization: 'Bearer any-token' },
    });

    assert.equal(hasAgentAuthorization(missingTokenRequest), false);
    assert.equal(requireAgentAuthorization(missingTokenRequest)?.status, 401);

    process.env[AGENT_API_TOKEN_ENV] = 'agent-secret';

    const missingHeaderRequest = new Request('https://example.com/api/agent/chat', {
      method: 'POST',
    });
    assert.equal(hasAgentAuthorization(missingHeaderRequest), false);
    assert.equal(requireAgentAuthorization(missingHeaderRequest)?.status, 401);

    const invalidHeaderRequest = new Request('https://example.com/api/agent/execute', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong-secret' },
    });
    assert.equal(hasAgentAuthorization(invalidHeaderRequest), false);
    assert.equal(requireAgentAuthorization(invalidHeaderRequest)?.status, 401);

    const validRequest = new Request('https://example.com/api/agent/execute', {
      method: 'POST',
      headers: { authorization: 'Bearer agent-secret' },
    });
    assert.equal(hasAgentAuthorization(validRequest), true);
    assert.equal(requireAgentAuthorization(validRequest), null);

    assertGuardBeforeBodyParsing('src/app/api/agent/chat/route.ts');
    assertGuardBeforeBodyParsing('src/app/api/agent/execute/route.ts');
  } finally {
    if (originalToken === undefined) {
      delete process.env[AGENT_API_TOKEN_ENV];
    } else {
      process.env[AGENT_API_TOKEN_ENV] = originalToken;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
