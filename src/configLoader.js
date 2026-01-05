// Config loader - reads YAML configuration
import { readFileSync, existsSync } from 'fs';
import { parse } from 'yaml';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '..', 'config.yaml');
const EXAMPLE_CONFIG_PATH = join(__dirname, '..', 'config.example.yaml');

/**
 * Load and parse the configuration file
 * @returns {Object} Parsed configuration
 */
export function loadConfig() {
  let configPath = CONFIG_PATH;
  
  if (!existsSync(CONFIG_PATH)) {
    if (existsSync(EXAMPLE_CONFIG_PATH)) {
      console.warn('⚠️  config.yaml not found, using config.example.yaml');
      configPath = EXAMPLE_CONFIG_PATH;
    } else {
      throw new Error('No configuration file found. Please create config.yaml');
    }
  }
  
  const configContent = readFileSync(configPath, 'utf8');
  const config = parse(configContent);
  
  // Validate required fields
  if (!config.repos || !Array.isArray(config.repos)) {
    throw new Error('Configuration must include a "repos" array');
  }
  
  // Set defaults
  config.triggerMode = config.triggerMode || 'webhook';
  config.webhook = config.webhook || { port: 4000, secret: '' };
  config.polling = config.polling || { interval: 60 };
  config.taskServer = config.taskServer || { url: 'http://localhost:3000', apiKey: '' };
  
  return config;
}

/**
 * Get repo configuration by name
 * @param {Object} config - Full config object
 * @param {string} repoName - Name of the repo to find
 * @returns {Object|null} Repo config or null
 */
export function getRepoByName(config, repoName) {
  return config.repos.find(r => r.name === repoName) || null;
}

/**
 * Get repo configuration by path
 * @param {Object} config - Full config object
 * @param {string} repoPath - Path of the repo to find
 * @returns {Object|null} Repo config or null
 */
export function getRepoByPath(config, repoPath) {
  return config.repos.find(r => r.path === repoPath) || null;
}

/**
 * Get TaskServer settings for a specific repo (with fallback to global)
 * @param {Object} config - Full config object
 * @param {Object} repo - Repo config object
 * @returns {Object} TaskServer settings
 */
export function getTaskServerConfig(config, repo) {
  return repo.taskServer || config.taskServer;
}
