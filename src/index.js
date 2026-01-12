// GitSync - Main entry point
import { loadConfig } from './configLoader.js';
import { createWebhookServer } from './webhook.js';
import { startPolling } from './polling.js';
import { deploy } from './deployer.js';
import { pingTaskServer } from './taskServerClient.js';

console.log(`
   _____ _ _   _____                  
  / ____(_) | / ____|                 
 | |  __ _| |_| (___  _   _ _ __   ___ 
 | | |_ | | __|\\___ \\| | | | '_ \\ / __|
 | |__| | | |_ ____) | |_| | | | | (__ 
  \\_____|_|\\__|_____/ \\__, |_| |_|\\___|
                       __/ |           
                      |___/            
`);
console.log('🔄 GitSync - Auto-deploy companion for TaskServer');
console.log('━'.repeat(50));

// Load configuration
let config;
try {
  config = loadConfig();
  console.log(`✓ Configuration loaded`);
  console.log(`  Trigger mode: ${config.triggerMode}`);
  console.log(`  Repositories: ${config.repos.length}`);
  for (const repo of config.repos) {
    console.log(`    - ${repo.name} (${repo.branch})`);
  }
} catch (error) {
  console.error(`❌ Failed to load configuration: ${error.message}`);
  process.exit(1);
}

// Check TaskServer connectivity
console.log(`\n🔌 Checking TaskServer connection...`);
const taskServerReachable = await pingTaskServer(config.taskServer);
if (taskServerReachable) {
  console.log(`✓ TaskServer is reachable at ${config.taskServer.url}`);
} else {
  console.warn(`⚠️  TaskServer not reachable at ${config.taskServer.url}`);
  console.warn(`   Script restarts will fail until TaskServer is running`);
}

// Deployment handler
async function handleDeploy(repoConfig, triggerInfo = null) {
  return deploy(config, repoConfig, triggerInfo);
}

// Initial Startup Check
console.log('\n' + '━'.repeat(50));
console.log('🚀 Running startup checks...');

for (const repo of config.repos) {
  console.log(`\nChecking ${repo.name}...`);
  // Trigger a "startup" deployment - this will ensure repo exists, pull updates, install deps, etc.
  await handleDeploy(repo, { provider: 'startup', pusher: 'system' });
}

// Start based on trigger mode
console.log('\n' + '━'.repeat(50));

let webhookServer = null;
let pollingController = null;

if (config.triggerMode === 'webhook' || config.triggerMode === 'both') {
  webhookServer = createWebhookServer(config, handleDeploy);
}

if (config.triggerMode === 'polling' || config.triggerMode === 'both') {
  pollingController = startPolling(config, handleDeploy);
}

console.log('━'.repeat(50));
console.log('🟢 GitSync is running. Press Ctrl+C to stop.\n');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down GitSync...');
  
  if (webhookServer) {
    webhookServer.stop();
    console.log('   Webhook server stopped');
  }
  
  if (pollingController) {
    pollingController.stop();
    console.log('   Polling stopped');
  }
  
  console.log('👋 Goodbye!\n');
  process.exit(0);
});

// Keep the process running
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
});
