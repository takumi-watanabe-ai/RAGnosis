/**
 * Session ID management for rate limiting
 * Stores a persistent session ID in localStorage
 */

const SESSION_KEY = "ragnosis_session_id";

/**
 * Generate a random session ID
 */
function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Get or create a session ID
 */
export function getSessionId(): string {
  if (typeof window === "undefined") {
    // Server-side rendering - return empty
    return "";
  }

  try {
    let sessionId = localStorage.getItem(SESSION_KEY);

    if (!sessionId) {
      sessionId = generateSessionId();
      localStorage.setItem(SESSION_KEY, sessionId);
    }

    return sessionId;
  } catch {
    // localStorage not available (private browsing, etc.)
    // Return a session ID for this page load only
    return generateSessionId();
  }
}
