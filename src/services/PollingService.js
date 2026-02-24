import { store } from '@/Store.js'
import { api } from '@/services/api.js'

/** @type {Object<string, {interval: number, apiFn: string, storeKey: string, dataKey: string, alwaysOn: boolean}>} */
const POLL_CONFIG = {
  heartbeat: { interval: 30000,  apiFn: 'getHeartbeat', storeKey: 'heartbeat', dataKey: 'data',  alwaysOn: true },
  tasks:     { interval: 30000, apiFn: 'getTasks',     storeKey: 'tasks',     dataKey: 'items', alwaysOn: true },
}

/**
 * Periodically polls the API for tasks and heartbeat data.
 * Pauses when the browser tab is hidden and resumes on focus.
 * Polls are scoped per view, with some running globally (alwaysOn).
 */
class PollingService {
  constructor() {
    this._intervals = {}
    this._currentView = null
    this._visible = true
  }

  /**
   * Stops all polling intervals and unsubscribes from store changes.
   */
  stop() {
    for (const section of Object.keys(this._intervals)) {
      this._stopInterval(section)
    }
    if (this._unsubscribe) {
      this._unsubscribe()
      this._unsubscribe = null
    }
  }

  /**
   * Fetches all poll sections once and returns when complete.
   * Call before start() so the UI has data on first paint.
   * @returns {Promise<void>}
   */
  async fetchAll() {
    await Promise.all(
      Object.keys(POLL_CONFIG).map(section => this._poll(section))
    )
  }

  /**
   * Starts polling. Subscribes to view changes, listens for visibility/focus
   * events, and begins intervals for always-on sections and the active view.
   */
  start() {
    // Track view changes
    this._currentView = store.getState().currentView
    this._unsubscribe = store.subscribe(() => {
      const view = store.getState().currentView
      if (view !== this._currentView) {
        this._onViewChange(view)
      }
    })

    // Visibility change (tab switch) and window focus (window switch)
    document.addEventListener('visibilitychange', () => this._onVisibilityChange())
    window.addEventListener('focus', () => this._onFocus())

    // Start always-on polls
    for (const [section, config] of Object.entries(POLL_CONFIG)) {
      if (config.alwaysOn) {
        this._startInterval(section)
      }
    }

    // Start active view poll if it's not always-on
    const activeConfig = POLL_CONFIG[this._currentView]
    if (activeConfig && !activeConfig.alwaysOn) {
      this._startInterval(this._currentView)
    }
  }

  /**
   * Handles view navigation: stops old view's poll, starts new view's poll,
   * and immediately fetches data for the new view.
   * @private
   * @param {string} view - New view name
   */
  _onViewChange(view) {
    const prev = this._currentView
    this._currentView = view

    // Stop previous view's interval if it's not always-on
    if (prev && POLL_CONFIG[prev] && !POLL_CONFIG[prev].alwaysOn) {
      this._stopInterval(prev)
    }

    // Start new view's interval if it's not always-on (and not already running)
    if (POLL_CONFIG[view] && !POLL_CONFIG[view].alwaysOn) {
      this._startInterval(view)
    }

    // Immediate fetch for the new view
    if (POLL_CONFIG[view]) {
      this._poll(view)
    }
  }

  /**
   * Pauses polling when the tab is hidden, resumes when visible.
   * @private
   */
  _onVisibilityChange() {
    if (document.hidden) {
      this._visible = false
      for (const section of Object.keys(this._intervals)) {
        this._stopInterval(section)
      }
    } else {
      this._visible = true
      this._resumePolling()
    }
  }

  /**
   * Refreshes the current view on window focus (only if tab is already visible).
   * @private
   */
  _onFocus() {
    if (!this._visible) return // visibilitychange will handle it
    this._refreshCurrentView()
  }

  /**
   * Restarts all always-on polls and the active view's poll after a pause.
   * @private
   */
  _resumePolling() {
    // Restart always-on polls
    for (const [section, config] of Object.entries(POLL_CONFIG)) {
      if (config.alwaysOn) {
        this._poll(section)
        this._startInterval(section)
      }
    }
    // Restart active view poll if not always-on
    const view = this._currentView
    if (view && POLL_CONFIG[view] && !POLL_CONFIG[view].alwaysOn) {
      this._poll(view)
      this._startInterval(view)
    }
  }

  /**
   * Triggers an immediate poll for the current view.
   * @private
   */
  _refreshCurrentView() {
    const view = this._currentView
    if (view && POLL_CONFIG[view]) {
      this._poll(view)
    }
  }

  /**
   * Fetches fresh data for a section and writes it to the store.
   * @private
   * @param {string} section - Section key from POLL_CONFIG
   */
  async _poll(section) {
    const config = POLL_CONFIG[section]
    if (!config) return
    try {
      const data = await api[config.apiFn]()
      store.setSectionData(config.storeKey, { [config.dataKey]: data, loading: false })
    } catch (e) {
      // Silently ignore poll errors — stale data is better than broken UI
    }
  }

  /**
   * Starts a setInterval timer for a section if not already running.
   * @private
   * @param {string} section - Section key from POLL_CONFIG
   */
  _startInterval(section) {
    if (this._intervals[section]) return // already running
    const config = POLL_CONFIG[section]
    if (!config) return
    this._intervals[section] = setInterval(() => this._poll(section), config.interval)
  }

  /**
   * Clears the interval timer for a section.
   * @private
   * @param {string} section - Section key from POLL_CONFIG
   */
  _stopInterval(section) {
    if (this._intervals[section]) {
      clearInterval(this._intervals[section])
      delete this._intervals[section]
    }
  }
}

export const pollingService = new PollingService()
