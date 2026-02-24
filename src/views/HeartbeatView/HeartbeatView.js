import { store } from '@/Store.js'
import { api } from '@/services/api.js'
import { html } from '@/utils/html.js'
import { icons } from '@/utils/icons.js'
import { relativeTime } from '@/utils/formatters.js'
import './HeartbeatView.css'

/**
 * View for monitoring the AI assistant's heartbeat status and configuration.
 * Displays live status (threads, last heartbeat time) and the HEARTBEAT.md content.
 * @extends HTMLElement
 */
export class HeartbeatView extends HTMLElement {
  /** @override */
  connectedCallback() {
    this._heartbeatContent = ''
    this._lastDataJSON = null
    this._error = null
    this.render()
    this._loadData()

    this.addEventListener('click', this._handleClick.bind(this))

    this._unsubscribe = store.subscribe(() => {
      const { heartbeat } = store.getState()
      if (!heartbeat.data) return
      const json = JSON.stringify(heartbeat.data)
      if (json === this._lastDataJSON) return
      this._lastDataJSON = json
      this._renderStatus(heartbeat.data)
    })
  }

  /** @override */
  disconnectedCallback() {
    if (this._unsubscribe) this._unsubscribe()
  }

  /** Called by ViewManager when this view becomes visible. Refreshes heartbeat data. */
  onActivate() {
    this._loadData()
  }

  /**
   * Fetches heartbeat status and content from the API in parallel.
   * @private
   */
  async _loadData() {
    store.setSectionData('heartbeat', { loading: true })

    try {
      // Load heartbeat status and content
      const [data, contentResponse] = await Promise.all([
        api.getHeartbeat(),
        api.getHeartbeatContent()
      ])

      store.setSectionData('heartbeat', { data, loading: false })
      this._data = data
      this._heartbeatContent = contentResponse || ''
      this._renderHeartbeatContent()
      this._renderStatus(data)
    } catch (error) {
      console.error('Failed to load heartbeat data:', error)
      this._error = 'Failed to load heartbeat data. Make sure the worker is running and configured.'
      store.setSectionData('heartbeat', { data: {}, loading: false })
      this._renderError()
    }
  }

  /**
   * @param {MouseEvent} e
   * @private
   */
  _handleClick(e) {
    if (e.target.closest('.thread-info-btn')) {
      this._showThreadInfo()
    } else if (e.target.closest('.retry-heartbeat-btn')) {
      this._error = null
      this._loadData()
    } else if (e.target.closest('.interval-change-btn')) {
      this._showIntervalEditor()
    } else if (e.target.closest('.interval-save-btn')) {
      this._saveInterval()
    } else if (e.target.closest('.interval-cancel-btn')) {
      this._hideIntervalEditor()
    }
  }

  /** Displays an alert explaining the active thread types. @private */
  _showThreadInfo() {
    const { assistant } = store.getState()

    alert(`Active Threads Explained:

1. Main Session Handler - Processes incoming messages and commands
2. Heartbeat Monitor - Runs periodic checks and maintenance tasks
3. Background Tasks - Handles file processing and long-running operations

These threads ensure ${assistant.name} can multitask and respond quickly while handling background work.`)
  }

  /** Renders error state with retry button in both sections. @private */
  _renderError() {
    const statusSection = this.querySelector('.heartbeat-status-section')
    const contentSection = this.querySelector('.heartbeat-content-section')
    if (statusSection) {
      statusSection.innerHTML = html`
        <div class="heartbeat-error">
          <span class="error-icon">${icons.circle}</span>
          <div class="error-content">
            <p><strong>Unable to load heartbeat data</strong></p>
            <p>${this._error}</p>
            <button class="retry-heartbeat-btn">Retry Loading</button>
          </div>
        </div>
      `
    }
    if (contentSection) contentSection.innerHTML = ''
  }

  /** Updates the HEARTBEAT.md content display section. @private */
  _renderHeartbeatContent() {
    const contentSection = this.querySelector('.heartbeat-content-section')
    if (!contentSection) return

    contentSection.innerHTML = html`
      <div class="heartbeat-content-header">
        <h3>Current Heartbeat Configuration</h3>
        <p>HEARTBEAT.md contents</p>
      </div>

      <div class="heartbeat-content-display">
        <pre>${this._heartbeatContent || 'Loading heartbeat configuration...'}</pre>
      </div>
    `
  }

  /**
   * Renders the status banner with avatar, thread count, and last heartbeat time.
   * @param {Object} data - Heartbeat data from the API.
   * @private
   */
  _renderStatus(data) {
    const statusSection = this.querySelector('.heartbeat-status-section')
    if (!statusSection) return

    const { assistant } = store.getState()
    const threadCount = data?.totalThreads || 3
    const lastHeartbeat = data?.lastHeartbeat ? new Date(data.lastHeartbeat) : new Date()
    const interval = data?.interval || 60

    statusSection.innerHTML = html`
      <div class="status-banner">
        <div class="status-left">
          <div class="status-avatar">
            <div class="avatar-circle-sm" style="background-color: ${assistant.color}">
              ${assistant.avatar ?
                `<img src="${assistant.avatar}" alt="${assistant.name}" class="avatar-image" />` :
                assistant.initials
              }
            </div>
            <span class="online-dot-sm"></span>
          </div>
          <div class="status-text">
            <span class="status-title">${assistant.name} is active</span>
            <div class="status-details">
              <span class="thread-info">
                <span class="thread-count">${threadCount} threads</span>
                <button class="thread-info-btn" title="What are these threads?">${icons.info}</button>
              </span>
              <span class="last-heartbeat">Last heartbeat: ${relativeTime(lastHeartbeat)}</span>
              <span class="heartbeat-interval">
                ${icons.clock} Checks in every ${interval} min
                <button class="interval-change-btn" title="Change check-in interval">${icons.edit}</button>
              </span>
            </div>
          </div>
        </div>
        <span class="live-indicator">
          <span class="live-dot"></span>
          LIVE
        </span>
      </div>
    `
  }

  /** Shows a dropdown editor to change the heartbeat interval. @private */
  _showIntervalEditor() {
    if (this.querySelector('.heartbeat-interval-editor')) return
    const currentInterval = this._data?.interval || 60
    const banner = this.querySelector('.status-banner')
    if (!banner) return

    const editor = document.createElement('div')
    editor.className = 'heartbeat-interval-editor'
    editor.innerHTML = html`
      <div class="interval-editor-content">
        <label>Agent check-in interval:</label>
        <div class="interval-editor-row">
          <select class="interval-select">
            <option value="15" ${currentInterval === 15 ? 'selected' : ''}>Every 15 min</option>
            <option value="30" ${currentInterval === 30 ? 'selected' : ''}>Every 30 min</option>
            <option value="60" ${currentInterval === 60 ? 'selected' : ''}>Every 60 min (recommended)</option>
            <option value="120" ${currentInterval === 120 ? 'selected' : ''}>Every 2 hours</option>
            <option value="360" ${currentInterval === 360 ? 'selected' : ''}>Every 6 hours</option>
          </select>
          <button class="interval-save-btn primary">Save</button>
          <button class="interval-cancel-btn">Cancel</button>
        </div>
      </div>
    `
    banner.after(editor)
  }

  /**
   * Saves the new interval: updates heartbeat data and creates a task for the agent.
   * @private
   */
  async _saveInterval() {
    const select = this.querySelector('.interval-select')
    if (!select) return
    const newInterval = parseInt(select.value, 10)

    try {
      // Create a one-off task instructing the agent to update its interval
      await api.createTask({
        title: `Update heartbeat interval to ${newInterval} minutes`,
        description: `Please update your heartbeat check-in interval to ${newInterval} minutes. Include "interval": ${newInterval} in your PUT /api/heartbeat requests.`,
      })

      // Update the heartbeat data with the new interval
      const currentData = this._data || {}
      const updatedData = { ...currentData, interval: newInterval }
      await api.updateHeartbeat(updatedData)

      // Update local state and re-render
      this._data = updatedData
      store.setSectionData('heartbeat', { data: updatedData })
      this._hideIntervalEditor()
      this._renderStatus(updatedData)
    } catch (error) {
      console.error('Failed to update heartbeat interval:', error)
      alert('Failed to update interval. Please try again.')
    }
  }

  /** Removes the interval editor from the DOM. @private */
  _hideIntervalEditor() {
    const editor = this.querySelector('.heartbeat-interval-editor')
    if (editor) editor.remove()
  }

  /** Renders the page header and empty section containers for status and content. */
  render() {
    const { assistant } = store.getState()

    this.innerHTML = html`
      <div class="page-header">
        <span class="page-header-icon">${icons.heartbeat}</span>
        <div class="page-header-text">
          <h1>Heartbeat</h1>
          <p>Monitor ${assistant.name}'s status and configure periodic checks</p>
        </div>
      </div>

      <div class="heartbeat-status-section"></div>

      <div class="heartbeat-content-section"></div>
    `
  }
}
