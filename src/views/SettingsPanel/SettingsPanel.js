import { html } from '@/utils/html.js'
import { icons } from '@/utils/icons.js'
import { store } from '@/Store.js'
import { api } from '@/services/api.js'
import { pollingService } from '@/services/PollingService.js'
import './SettingsPanel.css'

// Access data is now loaded dynamically from Puter KV via API

const API_ENDPOINTS = [
  { method: 'GET', path: '/api/tasks', label: 'List Tasks' },
  { method: 'POST', path: '/api/tasks', label: 'Create Task' },
  { method: 'GET', path: '/api/heartbeat', label: 'Get Heartbeat Status' },
  { method: 'GET', path: '/api/heartbeat/content', label: 'Get Heartbeat Content' },
  { method: 'GET', path: '/api/assistant/profile', label: 'Get Assistant Profile' },
  { method: 'GET', path: '/api/access', label: 'List Access Entries' },
]

/**
 * Settings view for managing worker connection, assistant profile, access entries,
 * and API endpoint testing. Also contains the danger-zone reset.
 * @extends HTMLElement
 */
export class SettingsPanel extends HTMLElement {
  /** @override */
  connectedCallback() {
    this._apiKey = localStorage.getItem('sb_api_key') || null
    this._expandedAccess = new Set()
    this._editingProfile = false
    this._accessData = []
    this._accessLoading = false
    this._accessError = null
    this.render()
    this._bindEvents()
    this._checkWorkerStatus()
    this._loadApiKey()
    
    // Initialize dynamic content
    setTimeout(() => {
      this._renderAssistantProfile()
      this._renderAutoInstallSection()
      this._renderAgentMessage()
      this._loadAccessData()
    }, 0)
  }

  /** Re-initializes the entire panel (called after setup modal completes). */
  refresh() {
    this._apiKey = localStorage.getItem('sb_api_key') || null
    this.render()
    this._bindEvents()
    this._checkWorkerStatus()
    this._loadApiKey()
    setTimeout(() => {
      this._renderAssistantProfile()
      this._renderAutoInstallSection()
      this._renderAgentMessage()
      this._loadAccessData()
    }, 0)
  }

  /**
   * Returns the configured worker URL from localStorage, with trailing slashes stripped.
   * @returns {string}
   * @private
   */
  _getWorkerUrl() {
    return (localStorage.getItem('worker_url') || '').replace(/\/+$/, '')
  }

  /**
   * Pings the worker heartbeat endpoint and updates the connection status indicator.
   * @private
   */
  async _checkWorkerStatus() {
    const statusEl = this.querySelector('.worker-status')
    if (!statusEl) return

    const workerUrl = this._getWorkerUrl()
    if (!workerUrl) {
      statusEl.innerHTML = html`
        <span class="status-indicator offline"></span>
        <span>Worker URL not configured</span>
      `
      return
    }

    try {
      const response = await fetch(`${workerUrl}/api/heartbeat`, {
        headers: this._apiKey ? { 'Authorization': `Bearer ${this._apiKey}` } : {}
      })
      
      if (response.ok) {
        this.querySelector('.generate-api-key-btn').style.display = 'none'
        this.querySelector('.save-api-key-btn').style.display = 'none'
        statusEl.innerHTML = html`
          <span class="status-indicator online"></span>
          <span>Connected to worker</span>
        `
      } else {
        this.querySelector('.generate-api-key-btn').style.display = 'block'
        this.querySelector('.save-api-key-btn').style.display = 'block'
        statusEl.innerHTML = html`
          <span class="status-indicator error"></span>
          <span>Worker responded with error</span>
        `
      }
    } catch (error) {
      this.querySelector('.generate-api-key-btn').style.display = 'block'
      this.querySelector('.save-api-key-btn').style.display = 'block'
      statusEl.innerHTML = html`
        <span class="status-indicator offline"></span>
        <span>Cannot reach worker</span>
      `
    }
  }

  /** Populates the API key input with the stored value. @private */
  _loadApiKey() {
    const apiKeyInput = this.querySelector('#api-key')
    if (apiKeyInput && this._apiKey) {
      apiKeyInput.value = this._apiKey
    }
  }

  /** Attaches delegated click handlers for all settings actions. @private */
  _bindEvents() {
    this.addEventListener('click', async (e) => {
      if (e.target.closest('.test-endpoint-btn')) {
        const btn = e.target.closest('.test-endpoint-btn')
        const method = btn.dataset.method
        const path = btn.dataset.path
        await this._testEndpoint(method, path, btn)
      } else if (e.target.closest('.save-worker-url-btn')) {
        this._saveWorkerUrl()
      } else if (e.target.closest('.save-api-key-btn')) {
        this._saveApiKey()
      } else if (e.target.closest('.generate-api-key-btn')) {
        this._generateApiKey()
      } else if (e.target.closest('.access-item-header')) {
        this._toggleAccessDetails(e.target.closest('.access-item'))
      } else if (e.target.closest('.manage-access-btn')) {
        this._showManageAccessForm()
      } else if (e.target.closest('.edit-profile-btn')) {
        this._startEditingProfile()
      } else if (e.target.closest('.save-profile-btn')) {
        this._saveAssistantProfile()
      } else if (e.target.closest('.cancel-profile-btn')) {
        this._cancelEditingProfile()
      } else if (e.target.closest('.reset-profile-btn')) {
        this._resetAssistantProfile()
      } else if (e.target.closest('.retry-access-btn')) {
        this._loadAccessData()
      } else if (e.target.closest('[data-action="copy-url"]')) {
        this._copyWorkerUrl()
      } else if (e.target.closest('[data-action="copy-key"]')) {
        this._copyApiKey()
      } else if (e.target.closest('.auto-install-btn')) {
        this._autoInstallWorker()
      } else if (e.target.closest('.copy-agent-msg-btn')) {
        this._copyAgentMessage()
      } else if (e.target.closest('.reset-clawboard-btn')) {
        this._resetClawboard()
      }
    })
  }

  /** Expands or collapses the detail panel for an access item. @private */
  _toggleAccessDetails(accessItem) {
    const accessId = accessItem.dataset.id
    const details = accessItem.querySelector('.access-details')
    const icon = accessItem.querySelector('.access-expand-icon')
    
    if (this._expandedAccess.has(accessId)) {
      this._expandedAccess.delete(accessId)
      details.hidden = true
      icon.innerHTML = icons.chevronRight
    } else {
      this._expandedAccess.add(accessId)
      details.hidden = false
      icon.innerHTML = icons.chevronDown
    }
  }

  /** Renders an inline form for requesting access changes. @private */
  _showManageAccessForm() {
    const { assistant } = store.getState()
    const formSection = this.querySelector('.manage-access-form')
    formSection.innerHTML = html`
      <div class="manage-form-header">
        <h4>Request Access Changes</h4>
        <p>Describe what access you'd like to modify for ${assistant.name}</p>
      </div>
      
      <form class="access-request-form">
        <div class="form-group">
          <textarea 
            id="access-request" 
            placeholder="E.g., 'Can you list all your access and capabilities', 'Add access to my calendar for scheduling' or 'Remove GitHub write access' or 'Add Spotify integration'"
            rows="4"
            required
          ></textarea>
        </div>
        
        <div class="form-actions">
          <button type="button" class="cancel-request-btn">Cancel</button>
          <button type="submit" class="submit-request-btn primary">Send Request</button>
        </div>
      </form>
    `

    // Bind form events
    const form = formSection.querySelector('.access-request-form')
    const cancelBtn = formSection.querySelector('.cancel-request-btn')
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      await this._submitAccessRequest()
    })
    
    cancelBtn.addEventListener('click', () => {
      formSection.innerHTML = html`
        <button class="manage-access-btn">
          ${icons.plus} Request Access Changes
        </button>
      `
    })
  }

  /** Creates a task for the agent containing the access change request. @private */
  async _submitAccessRequest() {
    const { assistant } = store.getState()
    const textarea = document.querySelector('#access-request')
    const request = textarea.value.trim()
    
    if (!request) {
      alert('Please describe the access changes you need')
      return
    }

    const submitBtn = document.querySelector('.submit-request-btn')
    const originalText = submitBtn.textContent
    submitBtn.disabled = true
    submitBtn.textContent = 'Sending...'

    try {
      // Create an access request as a task for the agent
      await api.createTask({ description: `ACCESS REQUEST: ${request}` })
      
      // Clear form and show success
      const formSection = document.querySelector('.manage-access-form')
      formSection.innerHTML = html`
        <div class="request-success">
          <span class="success-icon">${icons.checkCircle}</span>
          <p>Access request sent to ${assistant.name}!</p>
          <button class="manage-access-btn">
            ${icons.plus} Request More Changes
          </button>
        </div>
      `
      
    } catch (error) {
      console.error('Failed to submit access request:', error)
      alert('Failed to send request. Please try again.')
      submitBtn.disabled = false
      submitBtn.textContent = originalText
    }
  }

  /** Switches the assistant profile section into edit mode. @private */
  _startEditingProfile() {
    this._editingProfile = true
    this._renderAssistantProfile()
  }

  /** Exits profile edit mode without saving. @private */
  _cancelEditingProfile() {
    this._editingProfile = false
    this._renderAssistantProfile()
  }

  /** Saves the assistant profile to the store and persists to the API. @private */
  async _saveAssistantProfile() {
    const form = this.querySelector('.profile-edit-form')
    const formData = new FormData(form)
    
    const profile = {
      name: formData.get('name').trim() || 'Assistant',
      initials: formData.get('initials').trim() || 'A',
      avatar: formData.get('avatar').trim() || null,
      description: formData.get('description').trim() || 'AI Assistant',
      color: formData.get('color') || '#3b82f6'
    }

    // Update the store
    store.updateAssistantProfile(profile)

    // Try to save to API as well
    try {
      const workerUrl = this._getWorkerUrl()
      if (workerUrl && this._apiKey) {
        await fetch(`${workerUrl}/api/assistant/profile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this._apiKey}`
          },
          body: JSON.stringify(profile)
        })
      }
    } catch (error) {
      console.warn('Could not save profile to API:', error)
    }

    this._editingProfile = false
    this._renderAssistantProfile()
    
    // Show success feedback
    const btn = this.querySelector('.save-profile-btn')
    const originalText = btn.textContent
    btn.textContent = 'Saved!'
    setTimeout(() => {
      btn.textContent = originalText
    }, 2000)
  }

  /** Resets the assistant profile to defaults after user confirmation. @private */
  _resetAssistantProfile() {
    if (confirm('Reset to default Nova profile? This will undo all customizations.')) {
      store.resetAssistantProfile()
      this._editingProfile = false
      this._renderAssistantProfile()
    }
  }

  /** Deletes all server data, clears localStorage, and restarts the setup wizard. @private */
  async _resetClawboard() {
    if (!confirm('Are you sure? This will permanently delete all data and reset Clawboard to factory state. This cannot be undone.')) {
      return
    }

    const btn = this.querySelector('.reset-clawboard-btn')
    btn.disabled = true
    btn.textContent = 'Resetting...'

    try {
      const workerUrl = this._getWorkerUrl()
      if (workerUrl) {
        await fetch(`${workerUrl}/api/reset`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this._apiKey ? { 'Authorization': `Bearer ${this._apiKey}` } : {})
          }
        })
      }
    } catch (error) {
      console.warn('Could not reset server data:', error)
    }

    pollingService.stop()
    localStorage.clear()

    const modal = document.createElement('setup-modal')
    modal.setAttribute('mode', 'install')
    document.body.appendChild(modal)
    await modal.waitForComplete()
    window.location.reload()
  }

  /** Fetches access entries from the API and renders the access grid. @private */
  async _loadAccessData() {
    this._accessLoading = true
    this._accessError = null
    this._renderAccessGrid()

    try {
      const access = await api.getAccess()
      this._accessData = access
      this._accessLoading = false
      this._renderAccessGrid()
    } catch (error) {
      console.error('Failed to load access data:', error)
      this._accessError = 'Failed to load access data. Make sure the worker is running and configured.'
      this._accessLoading = false
      this._renderAccessGrid()
    }
  }

  /** Renders the access grid with loading, error, empty, or populated states. @private */
  _renderAccessGrid() {
    const accessSection = this.querySelector('.access-grid')
    if (!accessSection) return

    if (this._accessLoading) {
      accessSection.innerHTML = html`
        <div class="access-loading">
          <div class="loading-spinner"></div>
          <p>Loading access data...</p>
        </div>
      `
      return
    }

    if (this._accessError) {
      accessSection.innerHTML = html`
        <div class="access-error">
          <span class="error-icon">${icons.circle}</span>
          <div class="error-content">
            <p><strong>Unable to load access data</strong></p>
            <p>${this._accessError}</p>
            <button class="retry-access-btn">
              Retry Loading
            </button>
          </div>
        </div>
      `
      return
    }

    if (this._accessData.length === 0) {
      accessSection.innerHTML = html`
        <div class="access-empty">
          <span class="empty-icon">${icons.plus}</span>
          <p>No access configured yet</p>
          <p>This appears to be a fresh installation. You agent should populate this section shortly</p>
        </div>
      `
      return
    }

    accessSection.innerHTML = this._accessData.map(access => html`
      <div class="access-item" data-id="${access.id || access.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}">
        <div class="access-item-header">
          <div class="access-main">
            <span class="access-icon">${icons[access.icon] || icons.circle}</span>
            <div class="access-info">
              <span class="access-name">${access.name}</span>
              <span class="access-type">${access.type}</span>
            </div>
          </div>
          <div class="access-status">
            <span class="status-indicator ${access.status}"></span>
            <span class="access-expand-icon">${icons.chevronRight}</span>
          </div>
        </div>
        
        <div class="access-description">${access.description}</div>
        
        <div class="access-details" hidden>
          ${this._renderAccessDetails(access.details)}
        </div>
      </div>
    `).join('')
  }

  /**
   * Renders access detail content, handling both string and object formats.
   * @param {string|Object|null} details
   * @returns {string} HTML string
   * @private
   */
  _renderAccessDetails(details) {
    if (typeof details === 'string') {
      // If details is a markdown string, render it as-is
      return html`<div class="access-details-markdown">${details}</div>`
    }
    
    if (typeof details === 'object' && details !== null) {
      // If details is an object, render key-value pairs
      return Object.entries(details).map(([key, value]) => html`
        <div class="detail-item">
          <span class="detail-key">${key.charAt(0).toUpperCase() + key.slice(1)}:</span>
          <span class="detail-value">${Array.isArray(value) ? value.join(', ') : value}</span>
        </div>
      `).join('')
    }

    return '<div class="access-details-empty">No details available</div>'
  }

  /** Renders the assistant profile section in either display or edit mode. @private */
  _renderAssistantProfile() {
    const profileSection = this.querySelector('.assistant-profile-section')
    if (!profileSection) return

    const assistant = store.getAssistantProfile()

    if (this._editingProfile) {
      profileSection.innerHTML = html`
        <div class="profile-edit-header">
          <h4>Edit Assistant Profile</h4>
          <p>Customize your AI assistant's identity and appearance</p>
        </div>
        
        <form class="profile-edit-form">
          <div class="form-row">
            <div class="form-group">
              <label for="profile-name">Assistant Name:</label>
              <input type="text" id="profile-name" name="name" value="${assistant.name}" 
                     placeholder="Nova" required />
            </div>
            <div class="form-group">
              <label for="profile-initials">Avatar Initials:</label>
              <input type="text" id="profile-initials" name="initials" value="${assistant.initials}" 
                     placeholder="N" maxlength="3" required />
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label for="profile-color">Avatar Color:</label>
              <input type="color" id="profile-color" name="color" value="${assistant.color}" />
            </div>
            <div class="form-group">
              <label for="profile-description">Description:</label>
              <input type="text" id="profile-description" name="description" value="${assistant.description}" 
                     placeholder="AI Assistant" />
            </div>
          </div>
          
          <div class="form-group">
            <label for="profile-avatar">Avatar Image URL (optional):</label>
            <input type="url" id="profile-avatar" name="avatar" value="${assistant.avatar || ''}" 
                   placeholder="https://example.com/avatar.png" />
            <small>Leave empty to use initials with the selected color</small>
          </div>
          
          <div class="profile-actions">
            <button type="button" class="reset-profile-btn">Reset to Default</button>
            <div class="profile-main-actions">
              <button type="button" class="cancel-profile-btn">Cancel</button>
              <button type="button" class="save-profile-btn primary">Save Changes</button>
            </div>
          </div>
        </form>
      `
    } else {
      profileSection.innerHTML = html`
        <div class="profile-display">
          <div class="profile-preview">
            <div class="profile-avatar" style="background-color: ${assistant.color}">
              ${assistant.avatar ? 
                `<img src="${assistant.avatar}" alt="${assistant.name}" />` : 
                assistant.initials
              }
            </div>
            <div class="profile-info">
              <span class="profile-name">${assistant.name}</span>
              <span class="profile-desc">${assistant.description}</span>
            </div>
          </div>
          <button class="edit-profile-btn">
            ${icons.edit} Edit Profile
          </button>
        </div>
      `
    }
  }

  /** Returns true if both worker URL and API key are missing/empty. @private */
  _isUnconfigured() {
    const url = localStorage.getItem('worker_url')
    const key = localStorage.getItem('sb_api_key')
    return !url && !key
  }

  /** Renders or hides the auto-install button based on configuration state. @private */
  _renderAutoInstallSection() {
    const section = this.querySelector('.auto-install-section')
    if (!section) return

    if (this._isUnconfigured()) {
      section.innerHTML = html`
        <div class="auto-install-box">
          <p class="auto-install-hint">No worker configured. You can auto-deploy one to your Puter account.</p>
          <button class="btn btn-primary auto-install-btn">Auto-Install Worker</button>
          <div class="auto-install-error" style="display: none;"></div>
        </div>
      `
    } else {
      section.innerHTML = ''
    }
  }

  /** Runs the auto-deploy workflow and populates the configuration fields. @private */
  async _autoInstallWorker() {
    const btn = this.querySelector('.auto-install-btn')
    if (!btn) return

    const originalText = btn.textContent
    btn.disabled = true
    btn.textContent = 'Installing...'

    try {
      const deploy = await import('@/services/WorkerDeployService.js')
      const result = await deploy.deploy()

      this._apiKey = result.apiKey

      const urlInput = this.querySelector('#worker-url')
      const keyInput = this.querySelector('#api-key')
      if (urlInput) urlInput.value = result.url
      if (keyInput) keyInput.value = result.apiKey

      this._renderAutoInstallSection()
      this._checkWorkerStatus()
      this._renderAgentMessage()
    } catch (err) {
      btn.disabled = false
      btn.textContent = originalText

      const errorEl = this.querySelector('.auto-install-error')
      if (errorEl) {
        errorEl.textContent = err.message || 'Deployment failed. Please try again.'
        errorEl.style.display = 'block'
      }
    }
  }

  /**
   * Builds the agent onboarding message using current credentials.
   * @returns {string|null} Message text, or null if credentials aren't configured.
   * @private
   */
  _getAgentMessage() {
    const url = this._getWorkerUrl()
    const key = this._apiKey
    if (!url || !key) return null
    return `I've set up a Clawboard dashboard where we can collaborate on tasks. Visit the URL below to start your onboarding — it will walk you through how to use the API.\n\nWorker URL: ${url}\nAPI Key: ${key}`
  }

  /** Renders the agent onboarding message section if credentials are configured. @private */
  _renderAgentMessage() {
    const container = this.querySelector('.agent-message-section')
    if (!container) return

    const msg = this._getAgentMessage()
    if (!msg) {
      container.innerHTML = ''
      return
    }

    container.innerHTML = html`
      <div class="agent-message-box">
        <h4>Agent Onboarding Message</h4>
        <p>Copy this message and paste it to your AI agent to get started.</p>
        <div class="agent-message-pre">
          <pre>${msg}</pre>
        </div>
        <button class="btn btn-primary copy-agent-msg-btn">Copy Message</button>
      </div>
    `
  }

  /** Copies the agent onboarding message to the clipboard. @private */
  async _copyAgentMessage() {
    const msg = this._getAgentMessage()
    if (!msg) return
    await navigator.clipboard.writeText(msg)
    const btn = this.querySelector('.copy-agent-msg-btn')
    if (!btn) return
    const orig = btn.textContent
    btn.textContent = 'Copied!'
    setTimeout(() => btn.textContent = orig, 1500)
  }

  /** Called by ViewManager when this view becomes visible. Refreshes dynamic sections. */
  onActivate() {
    this._checkWorkerStatus()
    this._loadAccessData()
    this._renderAssistantProfile()
    this._renderAutoInstallSection()
    this._renderAgentMessage()
  }

  /** Persists the worker URL to localStorage and puter.kv, then re-checks connectivity. @private */
  _saveWorkerUrl() {
    const input = this.querySelector('#worker-url')
    const url = input.value.trim().replace(/\/+$/, '')
    localStorage.setItem('worker_url', url)
    if (typeof puter !== 'undefined' && puter.kv) puter.kv.set('sb_worker_url', url)
    this._checkWorkerStatus()
    const btn = this.querySelector('.save-worker-url-btn')
    const originalText = btn.textContent
    btn.textContent = 'Saved!'
    btn.disabled = true
    setTimeout(() => {
      btn.textContent = originalText
      btn.disabled = false
    }, 1500)
  }

  /** Generates a new API key, pushes it to the worker, and stores it locally. @private */
  async _generateApiKey() {
    const baseUrl = this._getWorkerUrl()
    if (!baseUrl) {
      alert('Set the worker URL first')
      return
    }
    const key = 'sb_' + crypto.randomUUID().replace(/-/g, '').slice(0, 24)

    // Push the key to the worker's KV via /api/set-key
    const headers = { 'Content-Type': 'application/json' }
    if (this._apiKey) headers['Authorization'] = `Bearer ${this._apiKey}`
    const resp = await fetch(baseUrl + '/api/set-key', {
      method: 'POST',
      headers,
      body: JSON.stringify({ api_key: key }),
    })
    const result = await resp.json()
    if (result.error) {
      alert('Failed to set key on worker: ' + result.error)
      return
    }

    // Store locally for the frontend
    localStorage.setItem('sb_api_key', key)
    this._apiKey = key
    const input = this.querySelector('#api-key')
    if (input) input.value = key
  }

  /** Copies the worker URL to the clipboard. @private */
  async _copyWorkerUrl() {
    const url = this._getWorkerUrl()
    if (!url) return
    await navigator.clipboard.writeText(url)
    const btn = this.querySelector('[data-action="copy-url"]')
    const orig = btn.textContent
    btn.textContent = 'Copied!'
    setTimeout(() => btn.textContent = orig, 1500)
  }

  /** Copies the API key to the clipboard. @private */
  async _copyApiKey() {
    if (!this._apiKey) return
    await navigator.clipboard.writeText(this._apiKey)
    const btn = this.querySelector('[data-action="copy-key"]')
    const orig = btn.textContent
    btn.textContent = 'Copied!'
    setTimeout(() => btn.textContent = orig, 1500)
  }

  /** Persists the API key to localStorage and puter.kv, then re-checks worker connectivity. @private */
  _saveApiKey() {
    const input = this.querySelector('#api-key')
    const key = input.value.trim()
    this._apiKey = key
    localStorage.setItem('sb_api_key', key)
    if (typeof puter !== 'undefined' && puter.kv) puter.kv.set('sb_api_key', key)
    this._checkWorkerStatus()
    
    const btn = this.querySelector('.save-api-key-btn')
    const originalText = btn.textContent
    btn.textContent = 'Saved!'
    btn.disabled = true
    setTimeout(() => {
      btn.textContent = originalText
      btn.disabled = false
    }, 1500)
  }

  /**
   * Fires a test request against a given API endpoint and displays the response.
   * @param {string} method - HTTP method (GET, POST, etc.).
   * @param {string} path - API path (e.g. "/api/tasks").
   * @param {HTMLButtonElement} button - The button that triggered the test.
   * @private
   */
  async _testEndpoint(method, path, button) {
    const workerUrl = this._getWorkerUrl()
    if (!workerUrl) {
      alert('Please configure the worker URL first')
      return
    }

    const resultArea = this.querySelector('.test-result')
    const originalText = button.textContent
    button.disabled = true
    button.textContent = 'Testing...'

    try {
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(this._apiKey ? { 'Authorization': `Bearer ${this._apiKey}` } : {})
        }
      }

      const response = await fetch(`${workerUrl}${path}`, options)
      const result = await response.json()

      resultArea.innerHTML = html`
        <div class="result-header">
          <span class="result-status ${response.ok ? 'success' : 'error'}">
            ${response.status} ${response.statusText}
          </span>
          <span class="result-endpoint">${method} ${path}</span>
        </div>
        <pre class="result-body">${JSON.stringify(result, null, 2)}</pre>
      `
    } catch (error) {
      resultArea.innerHTML = html`
        <div class="result-header">
          <span class="result-status error">Error</span>
          <span class="result-endpoint">${method} ${path}</span>
        </div>
        <pre class="result-body error">${error.message}</pre>
      `
    } finally {
      button.disabled = false
      button.textContent = originalText
    }
  }

  /** Renders the full settings page: access, profile, config, API testing, and danger zone. */
  render() {
    const workerUrl = this._getWorkerUrl()
    
    this.innerHTML = html`
      <div class="page-header">
        <span class="page-header-icon">${icons.settings}</span>
        <div class="page-header-text">
          <h1>Settings</h1>
          <p>Configure dashboard and manage Nova's access & capabilities</p>
        </div>
      </div>

      <div class="settings-section">
        <h3>${store.getAssistantProfile().name}'s Access & Capabilities</h3>
        <p>Services and systems ${store.getAssistantProfile().name} currently has access to</p>
        
        <div class="access-grid">
          <!-- Dynamic content will be loaded here -->
        </div>

        <div class="manage-access-form">
          <button class="manage-access-btn">
            ${icons.plus} Request Access Changes
          </button>
        </div>
      </div>

      <div class="settings-section">
        <h3>Assistant Profile</h3>
        <p>Customize your AI assistant's identity and appearance in the dashboard</p>
        
        <div class="assistant-profile-section"></div>
      </div>

      <div class="settings-section">
        <h3>Dashboard Configuration</h3>
        <p>Connect to your Puter worker that provides the dashboard API</p>
        
        <div class="worker-status"></div>

        <div class="auto-install-section"></div>

        <div class="config-group">
          <label for="worker-url">Worker URL:</label>
          <div class="input-with-button">
            <input type="url" id="worker-url" value="${workerUrl}"
                   placeholder="https://your-worker.puter.site" />
            <button data-action="copy-url">Copy</button>
            <button class="save-worker-url-btn">Save</button>
          </div>
        </div>

        <div class="config-group">
          <label for="api-key">API Key:</label>
          <div class="input-with-button">
            <input type="password" id="api-key" placeholder="Enter API key if required" />
            <button data-action="copy-key">Copy</button>
            <button class="generate-api-key-btn" style="display: none;">Re-Generate</button>
            <button class="save-api-key-btn">Save</button>
          </div>
        </div>

        <div class="agent-message-section"></div>
      </div>

      <div class="settings-section">
        <h3>API Testing</h3>
        <p>Test dashboard API endpoints to verify connectivity</p>
        
        <div class="endpoints-grid">
          ${API_ENDPOINTS.map(endpoint => html`
            <button class="test-endpoint-btn" 
                    data-method="${endpoint.method}" 
                    data-path="${endpoint.path}">
              <span class="endpoint-method ${endpoint.method.toLowerCase()}">${endpoint.method}</span>
              <span class="endpoint-label">${endpoint.label}</span>
            </button>
          `).join('')}
        </div>

        <div class="test-result-section">
          <h4>Response</h4>
          <div class="test-result">
            <div class="empty-result">Select an endpoint above to test</div>
          </div>
        </div>
      </div>

      <div class="settings-section danger-zone">
        <h3>Danger Zone</h3>
        <p>Permanently reset your Clawboard instance. This will delete all tasks, heartbeat data, access entries, and assistant profile from the server, clear all local settings, and restart the setup wizard.</p>
        <button class="reset-clawboard-btn">
          ${icons.delete} Reset Clawboard
        </button>
      </div>
    `
  }
}