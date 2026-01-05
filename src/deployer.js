// Deployer - orchestrates the deployment process
import { gitPull, ensureRepo } from './gitPull.js';
import { installDependencies } from './dependencyInstaller.js';
import { restartScript, addScript } from './taskServerClient.js';
import { getTaskServerConfig } from './configLoader.js';

/**
 * Run a full deployment for a repository
 * @param {Object} config - Full configuration
 * @param {Object} repoConfig - Repository configuration
 * @param {Object} [triggerInfo] - Optional info about what triggered the deploy
 * @returns {Promise<Object>} Deployment result
 */
export async function deploy(config, repoConfig, triggerInfo = null) {
  const startTime = Date.now();
  const results = {
    repo: repoConfig.name,
    success: true,
    steps: [],
    duration: 0,
    trigger: triggerInfo
  };
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 DEPLOYING: ${repoConfig.name}`);
  console.log(`   Branch: ${repoConfig.branch}`);
  console.log(`   Path: ${repoConfig.path}`);
  if (repoConfig.repoUrl) {
    console.log(`   URL: ${repoConfig.repoUrl}`);
  }
  if (triggerInfo) {
    console.log(`   Trigger: ${triggerInfo.provider || 'manual'} push by ${triggerInfo.pusher || 'unknown'}`);
  }
  console.log('='.repeat(60));
  
  // Step 0: Ensure repo exists (clone if needed)
  if (repoConfig.repoUrl) {
    console.log('\n📂 Step 0: Ensure Repository Exists');
    const ensureResult = await ensureRepo(repoConfig.path, repoConfig.repoUrl, repoConfig.branch);
    results.steps.push({ step: 'ensure-repo', ...ensureResult });
    
    if (!ensureResult.success) {
      results.success = false;
      results.error = `Failed to ensure repo: ${ensureResult.error}`;
      console.error(`\n❌ DEPLOYMENT FAILED: ${results.error}`);
      return results;
    }
    
    // If we just cloned, always do the full setup
    if (ensureResult.cloned) {
      console.log('   (Fresh clone - will do full setup)');
    }
  }
  
  // Step 1: Git pull
  console.log('\n📥 Step 1: Git Pull');
  const pullResult = await gitPull(repoConfig.path, repoConfig.branch);
  results.steps.push({ step: 'git-pull', ...pullResult });
  
  if (!pullResult.success) {
    results.success = false;
    results.error = `Git pull failed: ${pullResult.message}`;
    console.error(`\n❌ DEPLOYMENT FAILED: ${results.error}`);
    return results;
  }
  
  // Check if we should skip rest (no changes and not a fresh clone)
  const wasCloned = results.steps.find(s => s.step === 'ensure-repo')?.cloned;
  if (!pullResult.changed && !wasCloned) {
    console.log('\n✅ No changes detected, skipping dependency install and restart');
    results.skipped = true;
    results.duration = Date.now() - startTime;
    return results;
  }
  
  // Step 2: Install dependencies
  if (repoConfig.dependencies && repoConfig.dependencies.type !== 'none') {
    console.log('\n📦 Step 2: Install Dependencies');
    const installResult = await installDependencies(repoConfig.path, repoConfig.dependencies);
    results.steps.push({ step: 'install-deps', ...installResult });
    
    if (!installResult.success && !installResult.skipped) {
      results.success = false;
      results.error = `Dependency installation failed: ${installResult.error}`;
      console.error(`\n❌ DEPLOYMENT FAILED: ${results.error}`);
      return results;
    }
  } else {
    console.log('\n⏭️  Step 2: Skipping dependency installation');
    results.steps.push({ step: 'install-deps', skipped: true });
  }
  
  // Step 3: Register scripts in TaskServer (if configured and this is a fresh clone)
  const taskServerConfig = getTaskServerConfig(config, repoConfig);
  if (wasCloned && repoConfig.registerScripts && repoConfig.registerScripts.length > 0) {
    console.log('\n📝 Step 3: Register Scripts in TaskServer');
    const registerResults = [];
    
    for (const scriptConfig of repoConfig.registerScripts) {
      const addResult = await addScript(scriptConfig, taskServerConfig);
      registerResults.push({ script: scriptConfig.name, ...addResult });
      
      if (addResult.success) {
        console.log(`   ✅ Registered: ${scriptConfig.name}`);
      } else {
        console.warn(`   ⚠️  Failed to register ${scriptConfig.name}: ${addResult.error}`);
      }
    }
    results.steps.push({ step: 'register-scripts', results: registerResults });
  }
  
  // Step 4: Restart scripts
  if (repoConfig.restartScripts && repoConfig.restartScripts.length > 0) {
    console.log('\n🔄 Step 4: Restart Scripts');
    
    const restartResults = [];
    for (const scriptName of repoConfig.restartScripts) {
      const restartResult = await restartScript(scriptName, taskServerConfig);
      restartResults.push({ script: scriptName, ...restartResult });
      
      if (!restartResult.success) {
        console.warn(`⚠️  Failed to restart ${scriptName}: ${restartResult.error}`);
      }
    }
    results.steps.push({ step: 'restart-scripts', results: restartResults });
  } else {
    console.log('\n⏭️  Step 4: No scripts configured to restart');
    results.steps.push({ step: 'restart-scripts', skipped: true });
  }
  
  results.duration = Date.now() - startTime;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ DEPLOYMENT COMPLETE: ${repoConfig.name}`);
  console.log(`   Duration: ${(results.duration / 1000).toFixed(2)}s`);
  console.log(`   Files changed: ${pullResult.files?.length || 0}`);
  if (wasCloned) console.log('   (New repo - fully set up)');
  console.log('='.repeat(60) + '\n');
  
  return results;
}

