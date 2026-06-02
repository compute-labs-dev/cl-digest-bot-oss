const STORAGE_KEY = 'cl_digest_agent_api_token';

export function getAgentApiAuthorizationHeader(): Record<string, string> {
  const existingToken = window.localStorage.getItem(STORAGE_KEY);
  const token = existingToken || window.prompt('Enter your agent API token');

  if (!token) {
    throw new Error('Agent API token is required');
  }

  if (!existingToken) {
    window.localStorage.setItem(STORAGE_KEY, token);
  }

  return { Authorization: `Bearer ${token}` };
}

export function clearAgentApiToken() {
  window.localStorage.removeItem(STORAGE_KEY);
}
