/**
 * Simple event emitter for state change notifications
 * Extracted from Store.js for testability and reusability
 */

export class EventEmitter {
  constructor() {
    this.listeners = []
  }

  /**
   * Subscribe to events
   * @param {Function} listener - Callback function to be called on emit
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  /**
   * Emit event to all subscribers
   */
  emit() {
    this.listeners.forEach(listener => listener())
  }

  /**
   * Get current number of listeners
   * @returns {number} Number of subscribed listeners
   */
  getListenerCount() {
    return this.listeners.length
  }

  /**
   * Remove all listeners
   */
  clear() {
    this.listeners = []
  }
}
