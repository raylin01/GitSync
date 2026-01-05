// Polling mode - periodically check for git updates
import { checkForUpdates } from './gitPull.js';

/**
 * Start polling for updates on all configured repos
 * @param {Object} config - Full configuration
 * @param {Function} onUpdate - Callback when updates are found: (repoConfig) => void
 * @returns {Object} Controller with stop() method
 */
export function startPolling(config, onUpdate) {
  const interval = (config.polling?.interval || 60) * 1000;
  const repos = config.repos;
  
  console.log(`⏱️  Polling mode started (every ${interval / 1000}s)`);
  
  let running = true;
  let timeoutId = null;
  
  async function poll() {
    if (!running) return;
    
    for (const repo of repos) {
      if (!running) break;
      
      try {
        console.log(`🔍 Checking ${repo.name} for updates...`);
        const status = await checkForUpdates(repo.path, repo.branch);
        
        if (status.success && status.hasUpdates) {
          console.log(`📥 Updates found for ${repo.name} (${status.behind} commits behind)`);
          
          // Trigger deployment
          onUpdate(repo).catch(err => {
            console.error(`❌ Deployment failed for ${repo.name}: ${err.message}`);
          });
        } else if (status.success) {
          console.log(`✓ ${repo.name} is up to date`);
        } else {
          console.error(`⚠️  Failed to check ${repo.name}: ${status.error}`);
        }
      } catch (error) {
        console.error(`❌ Error checking ${repo.name}: ${error.message}`);
      }
    }
    
    // Schedule next poll
    if (running) {
      timeoutId = setTimeout(poll, interval);
    }
  }
  
  // Start polling
  poll();
  
  return {
    stop() {
      running = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      console.log('⏹️  Polling stopped');
    }
  };
}
