const STORAGE_KEY = 'nexus_session';
let loginInFlight = null;

function readNexusSession() {
  try {
    const session = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    return session && typeof session === 'object' ? session : null;
  } catch {
    return null;
  }
}

function isSessionValid(session, now = Date.now()) {
  const expirationTime = Date.parse(session?.tokenExpiresAt);
  return Boolean(
    typeof session?.token === 'string'
    && session.token
    && Number.isFinite(expirationTime)
    && now < expirationTime
  );
}

export function clearNexusSession() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function hasValidNexusSession(now = Date.now()) {
  const session = readNexusSession();
  if (isSessionValid(session, now)) return true;
  clearNexusSession();
  return false;
}

export function getNexusToken() {
  return hasValidNexusSession() ? readNexusSession().token : null;
}

export function getNexusSession() {
  return hasValidNexusSession() ? readNexusSession() : null;
}

export function validateAtLogin(credentials, httpClient) {
  if (loginInFlight) return loginInFlight;

  loginInFlight = httpClient.post('/auth/login', credentials)
    .then(({ data }) => {
      if (!isSessionValid(data.nexusSession)) {
        throw new Error('O NexusControl devolveu uma sessão inválida.');
      }
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data.nexusSession));
      return data;
    })
    .finally(() => {
      loginInFlight = null;
    });

  return loginInFlight;
}
