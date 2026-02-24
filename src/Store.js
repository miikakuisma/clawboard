import { EventEmitter } from '@/utils/EventEmitter.js'

/**
 * Centralized application state store with pub-sub change notification.
 * Components subscribe to state changes via {@link Store#subscribe} and
 * re-render when state is updated.
 */
class Store {
  constructor() {
    this.emitter = new EventEmitter()
    this.initialized = false
    this.state = {
      // Navigation state
      currentView: 'tasks',

      // Theme: 'system' | 'light' | 'dark'
      theme: localStorage.getItem('theme') || 'system',

      // Assistant Profile
      assistant: this._loadAssistantProfile(),

      // Assistant status  
      assistantStatus: 'active',

      // Section data
      tasks: { items: [], loading: false },
      heartbeat: { data: null, loading: false },
    }
  }

  /**
   * Returns the current state object.
   * @returns {Object} Current application state
   */
  getState() {
    return this.state
  }

  /**
   * Merges new values into state and notifies all subscribers.
   * @param {Object} newState - Partial state to merge
   */
  setState(newState) {
    this.state = { ...this.state, ...newState }
    this.emitter.emit()
  }

  /**
   * Registers a listener that is called whenever state changes.
   * @param {Function} listener - Callback invoked on state change
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    return this.emitter.subscribe(listener)
  }

  /**
   * Wraps a state-mutating function with automatic change detection.
   * Only emits if the state actually changed (deep comparison).
   * @private
   * @param {Function} fn - Function that mutates state
   * @returns {*} Return value of fn
   */
  _withChangeDetection(fn) {
    const oldState = JSON.parse(JSON.stringify(this.state))
    const result = fn()
    // Emit change event if state changed
    if (JSON.stringify(oldState) !== JSON.stringify(this.state)) {
      this.emitter.emit()
    }
    return result
  }

  /**
   * Switches the active view in the UI.
   * @param {string} view - View name (e.g. 'tasks', 'heartbeat', 'settings')
   */
  navigateToView(view) {
    this._withChangeDetection(() => {
      this.state.currentView = view
    })
  }

  /**
   * Sets the UI theme and persists the choice to localStorage.
   * @param {'system'|'light'|'dark'} theme - Theme identifier
   */
  setTheme(theme) {
    this._withChangeDetection(() => {
      this.state.theme = theme
      localStorage.setItem('theme', theme)
      if (typeof puter !== 'undefined' && puter.kv) puter.kv.set('sb_theme', theme)
    })
  }

  /**
   * Merges data into a named section of state (e.g. 'tasks', 'heartbeat').
   * @param {string} section - State key to update
   * @param {Object} data - Partial data to merge into the section
   */
  setSectionData(section, data) {
    this._withChangeDetection(() => {
      this.state[section] = { ...this.state[section], ...data }
    })
  }

  /**
   * Computes badge counts for the sidebar navigation.
   * @returns {{ tasks: number, tasksRunning: boolean }} Pending task count and whether any task is in progress
   */
  getBadgeCounts() {
    const { tasks } = this.state
    const taskItems = Array.isArray(tasks.items) ? tasks.items : []
    return {
      tasks: taskItems.filter(t => t.status === 'pending').length,
      tasksRunning: taskItems.some(t => t.status === 'in_progress'),
    }
  }

  /**
   * Loads the assistant profile from localStorage, falling back to defaults.
   * @private
   * @returns {Object} Assistant profile object
   */
  _loadAssistantProfile() {
    const saved = localStorage.getItem('assistant_profile')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.warn('Failed to parse saved assistant profile')
      }
    }
    
    // Default profile (Nova)
    return {
      name: 'Nova',
      initials: 'N',
      avatar: null, // URL to image, if any
      description: 'AI Assistant',
      color: '#3b82f6', // Accent color for avatar background
    }
  }

  /**
   * Returns the current assistant profile.
   * @returns {Object} Profile with name, initials, avatar, description, and color
   */
  getAssistantProfile() {
    return this.state.assistant
  }

  /**
   * Merges updates into the assistant profile and persists to localStorage.
   * @param {Object} updates - Partial profile fields to merge
   */
  updateAssistantProfile(updates) {
    const newProfile = { ...this.state.assistant, ...updates }
    this.setState({ assistant: newProfile })
    localStorage.setItem('assistant_profile', JSON.stringify(newProfile))
  }

  /**
   * Resets the assistant profile to defaults and removes the persisted copy.
   */
  resetAssistantProfile() {
    const defaultProfile = {
      name: 'Nova',
      initials: 'N', 
      avatar: null,
      description: 'AI Assistant',
      color: '#3b82f6',
    }
    this.setState({ assistant: defaultProfile })
    localStorage.removeItem('assistant_profile')
  }
}

// Create and export store instance
export const store = new Store()
