// Path utilities
import { join } from 'path';
import { homedir } from 'os';

/**
 * Expand tilde in paths to home directory
 * @param {string} p - Path that may contain tilde
 * @returns {string} Expanded path
 */
export function expandPath(p) {
  if (!p) return p;
  if (p.startsWith('~/')) {
    return join(homedir(), p.slice(2));
  }
  if (p === '~') {
    return homedir();
  }
  return p;
}
