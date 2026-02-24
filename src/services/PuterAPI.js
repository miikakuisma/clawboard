/**
 * @module PuterAPI
 * Fetch-based client for the Clawboard worker API. Worker URL and API key
 * are read from localStorage (set via SettingsPanel).
 */

/**
 * Returns the configured worker base URL from localStorage.
 * @private
 * @returns {string} Base URL with trailing slashes stripped
 * @throws {Error} If no worker URL is configured
 */
function getBaseUrl() {
  const url = localStorage.getItem('worker_url')
  if (!url) throw new Error('Worker URL not configured. Go to API Test panel and set the worker URL.')
  return url.replace(/\/+$/, '')
}

/**
 * Builds authorization headers from the stored API key.
 * @private
 * @returns {Object} Headers object, includes Authorization if key is set
 */
function getAuthHeaders() {
  const key = localStorage.getItem('sb_api_key')
  const headers = {}
  if (key) headers['Authorization'] = `Bearer ${key}`
  return headers
}

/**
 * Makes an authenticated fetch request to the worker API.
 * @private
 * @param {string} method - HTTP method
 * @param {string} path - API path (e.g. '/api/tasks')
 * @param {Object|null} [body=null] - Request body (JSON-serialized)
 * @returns {Promise<Object>} Parsed JSON response
 */
async function call(method, path, body = null) {
  const baseUrl = getBaseUrl()
  const url = baseUrl + path

  const options = {
    method,
    headers: { ...getAuthHeaders() },
  }
  if (body) {
    options.headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(body)
  }

  const response = await fetch(url, options)

  if (!response.ok) {
    let message
    try {
      const errorData = await response.json()
      message = errorData.error || JSON.stringify(errorData)
    } catch {
      message = `HTTP ${response.status} ${response.statusText}`
    }
    throw new Error(message)
  }

  return await response.json()
}

/**
 * Converts ISO date strings to Date objects on the given keys.
 * Works on single objects or arrays of objects.
 * @private
 * @param {Object|Array} obj - Object or array to hydrate
 * @param {...string} keys - Property names containing date strings
 * @returns {Object|Array} Shallow copy with Date objects in place of date strings
 */
function hydrateDates(obj, ...keys) {
  if (!obj) return obj
  if (Array.isArray(obj)) return obj.map(item => hydrateDates(item, ...keys))
  const result = { ...obj }
  for (const key of keys) {
    if (result[key]) result[key] = new Date(result[key])
  }
  return result
}

export const api = {
  /**
   * Fetches all tasks.
   * @returns {Promise<Array<Object>>} Tasks with hydrated date fields
   */
  async getTasks() {
    const items = await call('GET', '/api/tasks')
    return hydrateDates(items, 'createdAt', 'startedAt', 'completedAt', 'nextRunAfter')
  },

  /**
   * Creates a new task.
   * @param {Object} taskData - Task fields (title, description, etc.)
   * @returns {Promise<Object>} Created task with hydrated dates
   */
  async createTask(taskData) {
    const task = await call('POST', '/api/tasks', taskData)
    return hydrateDates(task, 'createdAt', 'startedAt', 'completedAt', 'nextRunAfter')
  },

  /**
   * Updates a task's description and/or repetition.
   * @param {string} taskId - Task identifier
   * @param {Object} data - Fields to update (description, repetition)
   * @returns {Promise<Object>} Updated task with hydrated dates
   */
  async updateTask(taskId, data) {
    const item = await call('PUT', `/api/tasks/${taskId}`, data)
    return hydrateDates(item, 'createdAt', 'startedAt', 'completedAt', 'nextRunAfter')
  },

  /**
   * Updates a task's status with optional notes and links.
   * @param {string} taskId - Task identifier
   * @param {string} status - New status ('pending'|'in_progress'|'completed')
   * @param {Object} [options]
   * @param {string} [options.notes] - Status notes
   * @param {Array<string>} [options.links] - Related links
   * @returns {Promise<Object>} Updated task with hydrated dates
   */
  async updateTaskStatus(taskId, status, { notes, links } = {}) {
    const body = { status }
    if (notes) body.notes = notes
    if (links) body.links = links
    const item = await call('PUT', `/api/tasks/${taskId}/status`, body)
    return hydrateDates(item, 'createdAt', 'startedAt', 'completedAt', 'nextRunAfter')
  },

  /**
   * Moves a task to 'in_progress'.
   * @param {string} taskId
   * @param {string} [notes]
   * @returns {Promise<Object>} Updated task
   */
  async startTask(taskId, notes) {
    return this.updateTaskStatus(taskId, 'in_progress', { notes })
  },

  /**
   * Marks a task as 'completed'.
   * @param {string} taskId
   * @param {Object} [options]
   * @param {string} [options.notes]
   * @param {Array<string>} [options.links]
   * @returns {Promise<Object>} Updated task
   */
  async completeTask(taskId, { notes, links } = {}) {
    return this.updateTaskStatus(taskId, 'completed', { notes, links })
  },

  /**
   * Resets a task back to 'pending'.
   * @param {string} taskId
   * @returns {Promise<Object>} Updated task
   */
  async resetTask(taskId) {
    return this.updateTaskStatus(taskId, 'pending')
  },

  /**
   * Deletes a task by ID.
   * @param {string} id - Task identifier
   * @returns {Promise<Object>} Deletion confirmation
   */
  async deleteTask(id) {
    return await call('DELETE', `/api/tasks/${id}`)
  },

  /**
   * Fetches heartbeat data including active tasks and recently completed items.
   * @returns {Promise<Object>} Heartbeat data with hydrated dates
   */
  async getHeartbeat() {
    const data = await call('GET', '/api/heartbeat')
    if (data.activeTasks) {
      data.activeTasks = hydrateDates(data.activeTasks, 'startedAt', 'eta')
    }
    if (data.recentlyCompleted) {
      data.recentlyCompleted = hydrateDates(data.recentlyCompleted, 'completedAt')
    }
    return data
  },

  /**
   * Updates heartbeat data (e.g. to change the interval).
   * @param {Object} data - Heartbeat data to store
   * @returns {Promise<Object>} Updated heartbeat data
   */
  async updateHeartbeat(data) {
    return await call('PUT', '/api/heartbeat', data)
  },

  /**
   * Fetches the heartbeat markdown content.
   * @returns {Promise<string>} Heartbeat content string
   */
  async getHeartbeatContent() {
    const result = await call('GET', '/api/heartbeat/content')
    return result.content || ''
  },

  /**
   * Updates the heartbeat markdown content.
   * @param {string} content - New heartbeat content
   * @returns {Promise<Object>} Update confirmation
   */
  async updateHeartbeatContent(content) {
    return await call('POST', '/api/heartbeat/content', { content })
  },

  /**
   * Fetches the assistant profile from the server.
   * @returns {Promise<Object>} Assistant profile data
   */
  async getAssistantProfile() {
    return await call('GET', '/api/assistant/profile')
  },

  /**
   * Updates the assistant profile on the server.
   * @param {Object} profile - Profile fields to update
   * @returns {Promise<Object>} Updated profile
   */
  async updateAssistantProfile(profile) {
    const result = await call('POST', '/api/assistant/profile', profile)
    return result.profile
  },

  /**
   * Fetches all access entries.
   * @returns {Promise<Array<Object>>} List of access entries
   */
  async getAccess() {
    const items = await call('GET', '/api/access')
    return items || []
  },

  /**
   * Creates a new access entry.
   * @param {Object} accessData - Access configuration
   * @returns {Promise<Object>} Created access entry
   */
  async createAccess(accessData) {
    return await call('POST', '/api/access', accessData)
  },

  /**
   * Updates an existing access entry.
   * @param {string} id - Access entry identifier
   * @param {Object} accessData - Fields to update
   * @returns {Promise<Object>} Updated access entry
   */
  async updateAccess(id, accessData) {
    return await call('PUT', `/api/access/${id}`, accessData)
  },

  /**
   * Deletes an access entry by ID.
   * @param {string} id - Access entry identifier
   * @returns {Promise<Object>} Deletion confirmation
   */
  async deleteAccess(id) {
    return await call('DELETE', `/api/access/${id}`)
  },
}
