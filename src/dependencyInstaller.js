// Dependency installer - npm, bun, yarn, pip
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';
import { expandPath } from './pathUtils.js';

const execAsync = promisify(exec);

/**
 * Install dependencies based on the configured type
 * @param {string} repoPath - Path to the repository
 * @param {Object} depConfig - Dependency configuration { type: 'npm'|'bun'|'yarn'|'pip', venv?: string }
 * @returns {Promise<Object>} Result of the installation
 */
export async function installDependencies(repoPath, depConfig) {
  // Expand tilde in path
  const expandedPath = expandPath(repoPath);
  
  if (!depConfig || depConfig.type === 'none') {
    console.log('⏭️  Skipping dependency installation (type: none)');
    return { success: true, skipped: true };
  }
  
  const { type, venv } = depConfig;
  console.log(`📦 Installing dependencies (${type})...`);
  
  try {
    switch (type) {
      case 'npm':
        return await installNpm(expandedPath);
      case 'bun':
        return await installBun(expandedPath);
      case 'yarn':
        return await installYarn(expandedPath);
      case 'pip':
        return await installPip(expandedPath, venv);
      default:
        console.warn(`⚠️  Unknown dependency type: ${type}`);
        return { success: false, error: `Unknown dependency type: ${type}` };
    }
  } catch (error) {
    console.error(`❌ Dependency installation failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function installNpm(repoPath) {
  const packageJson = join(repoPath, 'package.json');
  if (!existsSync(packageJson)) {
    console.log('⏭️  No package.json found, skipping npm install');
    return { success: true, skipped: true };
  }
  
  const { stdout, stderr } = await execAsync('npm install', { cwd: repoPath });
  console.log('✅ npm install completed');
  return { success: true, stdout, stderr };
}

async function installBun(repoPath) {
  const packageJson = join(repoPath, 'package.json');
  if (!existsSync(packageJson)) {
    console.log('⏭️  No package.json found, skipping bun install');
    return { success: true, skipped: true };
  }
  
  const { stdout, stderr } = await execAsync('bun install', { cwd: repoPath });
  console.log('✅ bun install completed');
  return { success: true, stdout, stderr };
}

async function installYarn(repoPath) {
  const packageJson = join(repoPath, 'package.json');
  if (!existsSync(packageJson)) {
    console.log('⏭️  No package.json found, skipping yarn install');
    return { success: true, skipped: true };
  }
  
  const { stdout, stderr } = await execAsync('yarn install', { cwd: repoPath });
  console.log('✅ yarn install completed');
  return { success: true, stdout, stderr };
}

async function installPip(repoPath, venvConfig) {
  const requirementsFile = join(repoPath, 'requirements.txt');
  if (!existsSync(requirementsFile)) {
    console.log('⏭️  No requirements.txt found, skipping pip install');
    return { success: true, skipped: true };
  }
  
  let pipPath = 'pip';
  let venvPath = null;
  
  // Handle venv configuration
  if (venvConfig) {
    if (venvConfig === 'auto') {
      // Auto-create venv if it doesn't exist
      venvPath = join(repoPath, '.venv');
      if (!existsSync(venvPath)) {
        console.log('🔧 Creating virtual environment...');
        await execAsync('python3 -m venv .venv', { cwd: repoPath });
      }
    } else {
      // Use specified venv path
      venvPath = venvConfig;
    }
    
    // Use pip from venv
    pipPath = join(venvPath, 'bin', 'pip');
    if (!existsSync(pipPath)) {
      pipPath = join(venvPath, 'Scripts', 'pip'); // Windows fallback
    }
  }
  
  const { stdout, stderr } = await execAsync(`${pipPath} install -r requirements.txt`, { cwd: repoPath });
  console.log('✅ pip install completed');
  return { success: true, stdout, stderr, venvPath };
}
