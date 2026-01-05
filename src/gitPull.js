// Git operations - pull, fetch, check for changes
import simpleGit from 'simple-git';

/**
 * Perform a git pull on the specified repository
 * @param {string} repoPath - Path to the git repository
 * @param {string} branch - Branch to pull
 * @returns {Promise<Object>} Result of the git pull operation
 */
export async function gitPull(repoPath, branch = 'main') {
  const git = simpleGit(repoPath);
  
  console.log(`📥 Pulling ${branch} in ${repoPath}...`);
  
  try {
    // Fetch first to update remote refs
    await git.fetch('origin', branch);
    
    // Check current branch
    const status = await git.status();
    if (status.current !== branch) {
      console.log(`⚠️  Currently on branch '${status.current}', checking out '${branch}'...`);
      await git.checkout(branch);
    }
    
    // Pull changes
    const pullResult = await git.pull('origin', branch);
    
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
  const git = simpleGit(repoPath);
  
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
  const git = simpleGit(repoPath);
  const log = await git.log({ maxCount: 1 });
  return log.latest?.hash || null;
}
