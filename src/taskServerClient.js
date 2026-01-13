// TaskServer API client - for restarting scripts
/**
 * Restart a script via TaskServer's JSON API
 * @param {string} scriptName - Name of the script to restart
 * @param {Object} taskServerConfig - TaskServer config { url, apiKey }
 * @returns {Promise<Object>} Result of the restart operation
 */
export async function restartScript(scriptName, taskServerConfig) {
  const { url, apiKey } = taskServerConfig;
  const endpoint = `${url}/api/restart-script/${encodeURIComponent(scriptName)}`;
  
  console.log(`Restarting script: ${scriptName}...`);
  
  try {
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log(`Script '${scriptName}' restarted successfully`);
      return { success: true, message: data.message, logFile: data.logFile };
    } else {
      console.error(`Failed to restart '${scriptName}': ${data.error || 'Unknown error'}`);
      return { success: false, error: data.error || 'Unknown error' };
    }
  } catch (error) {
    console.error(`TaskServer request failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Stop a script via TaskServer's JSON API
 * @param {string} scriptName - Name of the script to stop
 * @param {Object} taskServerConfig - TaskServer config { url, apiKey }
 * @returns {Promise<Object>} Result of the stop operation
 */
export async function stopScript(scriptName, taskServerConfig) {
  const { url, apiKey } = taskServerConfig;
  const endpoint = `${url}/api/stop-script/${encodeURIComponent(scriptName)}`;
  
  console.log(`Stopping script: ${scriptName}...`);
  
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['X-API-Key'] = apiKey;
    
    const response = await fetch(endpoint, { method: 'POST', headers });
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log(`Script '${scriptName}' stopped`);
      return { success: true, message: data.message };
    } else {
      console.error(`Failed to stop '${scriptName}': ${data.error}`);
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.error(`TaskServer request failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Start a script via TaskServer's JSON API
 * @param {string} scriptName - Name of the script to start
 * @param {Object} taskServerConfig - TaskServer config { url, apiKey }
 * @returns {Promise<Object>} Result of the start operation
 */
export async function startScript(scriptName, taskServerConfig) {
  const { url, apiKey } = taskServerConfig;
  const endpoint = `${url}/api/start-script/${encodeURIComponent(scriptName)}`;
  
  console.log(`Starting script: ${scriptName}...`);
  
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['X-API-Key'] = apiKey;
    
    const response = await fetch(endpoint, { method: 'POST', headers });
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log(`Script '${scriptName}' started`);
      return { success: true, message: data.message };
    } else {
      console.error(`Failed to start '${scriptName}': ${data.error}`);
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.error(`TaskServer request failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * List all scripts from TaskServer
 * @param {Object} taskServerConfig - TaskServer config { url, apiKey }
 * @returns {Promise<Object>} List of scripts or error
 */
export async function listScripts(taskServerConfig) {
  const { url, apiKey } = taskServerConfig;
  const endpoint = `${url}/api/scripts`;
  
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['X-API-Key'] = apiKey;
    
    const response = await fetch(endpoint, { method: 'GET', headers });
    const data = await response.json();
    
    if (response.ok && data.success) {
      return { success: true, scripts: data.scripts };
    } else {
      return { success: false, error: data.error };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Check if TaskServer is reachable
 * @param {Object} taskServerConfig - TaskServer config { url, apiKey }
 * @returns {Promise<boolean>} True if reachable
 */
export async function pingTaskServer(taskServerConfig) {
  try {
    const result = await listScripts(taskServerConfig);
    return result.success;
  } catch {
    return false;
  }
}

/**
 * Add a new script to TaskServer
 * @param {Object} scriptConfig - Script configuration { name, path?, command?, type, schedule?, args?, env? }
 * @param {Object} taskServerConfig - TaskServer config { url, apiKey }
 * @returns {Promise<Object>} Result of the add operation
 */
export async function addScript(scriptConfig, taskServerConfig) {
  const { url, apiKey } = taskServerConfig;
  const endpoint = `${url}/api/add-script`;
  
  console.log(`Adding script: ${scriptConfig.name}...`);
  
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['X-API-Key'] = apiKey;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(scriptConfig)
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log(`Script '${scriptConfig.name}' added successfully`);
      return { success: true, message: data.message };
    } else {
      console.error(`Failed to add '${scriptConfig.name}': ${data.error || 'Unknown error'}`);
      return { success: false, error: data.error || 'Unknown error' };
    }
  } catch (error) {
    console.error(`TaskServer request failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

