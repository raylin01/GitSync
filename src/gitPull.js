// Git operations - clone, pull, fetch, check for changes
import simpleGit from 'simple-git';
import { existsSync, readdirSync, mkdirSync } from 'fs';
import { expandPath } from './pathUtils.js';

/**
 * Check if a directory is a git repository
 * @param {string} repoPath - Path to check
 * @returns {boolean} True if it's a git repo
 */
export function isGitRepo(repoPath) {
  const p = expandPath(repoPath);
  return existsSync(p) && existsSync(`${p}/.git`);
}

/**
 * Check if a directory is empty or doesn't exist
 * @param {string} dirPath - Path to check
 * @returns {boolean} True if empty or non-existent
 */
export function isEmptyOrMissing(dirPath) {
  const p = expandPath(dirPath);
  if (!existsSync(p)) return true;
  const files = readdirSync(p);
  return files.length === 0;
}

/**
 * Clone a git repository
 * @param {string} repoUrl - URL of the repository to clone
 * @param {string} repoPath - Local path to clone into
 * @param {string} branch - Branch to checkout after clone
 * @returns {Promise<Object>} Result of the clone operation
 */
export async function gitClone(repoUrl, repoPath, branch = 'main') {
  const p = expandPath(repoPath);
  console.log(`📦 Cloning ${repoUrl} to ${p}...`);
  
  try {
    // Create parent directory if it doesn't exist
    const parentDir = p.substring(0, p.lastIndexOf('/'));
    if (parentDir && !existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }
    
    const git = simpleGit();
    await git.clone(repoUrl, p, ['--branch', branch]);
    
    console.log(`✅ Cloned successfully to ${repoPath}`);
    return {
      success: true,
      cloned: true,
      message: `Cloned ${repoUrl} to ${repoPath}`,
      path: repoPath
    };
  } catch (error) {
    console.error(`❌ Git clone failed: ${error.message}`);
    return {
      success: false,
      cloned: false,
      message: error.message,
      error
    };
  }
}

/**
 * Ensure a repo exists - clone if missing, otherwise just return success
 * @param {string} repoPath - Path to the repository
 * @param {string} repoUrl - URL to clone from if missing
 * @param {string} branch - Branch to use
 * @returns {Promise<Object>} Result including whether clone was needed
 */
export async function ensureRepo(repoPath, repoUrl, branch = 'main') {
  if (isGitRepo(repoPath)) {
    console.log(`✓ Repository already exists at ${repoPath}`);
    return { success: true, cloned: false, existed: true };
  }
  
  if (!repoUrl) {
    console.error(`❌ Repository not found at ${repoPath} and no repoUrl provided for cloning`);
    return { 
      success: false, 
      error: 'Repository not found and no repoUrl provided for cloning' 
    };
  }
  
  // Clone the repo
  return gitClone(repoUrl, repoPath, branch);
}

/**
 * Perform a git pull on the specified repository
 * @param {string} repoPath - Path to the git repository
 * @param {string} branch - Branch to pull
 * @returns {Promise<Object>} Result of the git pull operation
 */
export async function gitPull(repoPath, branch = 'main') {
  const p = expandPath(repoPath);
  const git = simpleGit(p);
  
  console.log(`📥 Pulling ${branch} in ${p}...`);
  
  try {
    // Fetch first to update remote refs
    await git.fetch('origin', branch);
    
    // Check current branch
    const status = await git.status();
    if (status.current !== branch) {
      console.log(`⚠️  Currently on branch '${status.current}', checking out '${branch}'...`);
      await git.checkout(branch);
    }
    
    // Pull changes with rebase
    console.log('   (Using --rebase to preserve local changes)');
    const pullResult = await git.pull('origin', branch, {'--rebase': 'true'});
    
    if (pullResult.summary.changes === 0 && pullResult.summary.insertions === 0 && pullResult.summary.deletions === 0) {
      console.log('✅ Already up to date');
      return { 
        success: true, 
        changed: false, 
        message: 'Already up to date',
        files: []
      };
    }
    
    console.log(`✅ Pulled ${pullResult.summary.changes} changes`);
    console.log(`   Files: ${pullResult.files.length}, +${pullResult.summary.insertions}/-${pullResult.summary.deletions}`);
    
    return {
      success: true,
      changed: true,
      message: `Pulled ${pullResult.summary.changes} changes`,
      files: pullResult.files,
      summary: pullResult.summary
    };
  } catch (error) {
    console.error(`❌ Git pull failed: ${error.message}`);
    return {
      success: false,
      changed: false,
      message: error.message,
      error
    };
  }
}

/**
 * Check if the local branch is behind the remote
 * @param {string} repoPath - Path to the git repository
 * @param {string} branch - Branch to check
 * @returns {Promise<Object>} Status including whether updates are available
 */
export async function checkForUpdates(repoPath, branch = 'main') {
  const p = expandPath(repoPath);
  const git = simpleGit(p);
  
  try {
    // Fetch to update remote refs
    await git.fetch('origin', branch);
    
    // Get the status
    const status = await git.status();
    
    return {
      success: true,
      behind: status.behind,
      ahead: status.ahead,
      hasUpdates: status.behind > 0,
      currentBranch: status.current
    };
  } catch (error) {
    console.error(`❌ Failed to check for updates: ${error.message}`);
    return {
      success: false,
      hasUpdates: false,
      error: error.message
    };
  }
}

/**
 * Get the current commit hash
 * @param {string} repoPath - Path to the git repository
 * @returns {Promise<string>} Current commit hash
 */
export async function getCurrentCommit(repoPath) {
  const p = expandPath(repoPath);
  const git = simpleGit(p);
  const log = await git.log({ maxCount: 1 });
  return log.latest?.hash || null;
}

