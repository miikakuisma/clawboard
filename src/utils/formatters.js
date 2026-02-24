/**
 * @module formatters
 * Human-readable formatting utilities for dates, file sizes, and durations.
 */

/**
 * Formats a date as a human-readable relative time string (e.g. "5m ago", "2d ago").
 * @param {Date|string|number} date - Date value to format
 * @returns {string} Relative time string, or empty string if no date provided
 */
export function relativeTime(date) {
  if (!date) return ''
  if (!(date instanceof Date)) date = new Date(date)
  const now = Date.now()
  const diff = now - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

/**
 * Formats a byte count as a human-readable file size (e.g. "1.5 MB").
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted file size string
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const size = (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)
  return `${size} ${units[i]}`
}

/**
 * Formats a duration in milliseconds as a human-readable string (e.g. "2m 30s").
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration string, or empty string if falsy
 */
export function formatDuration(ms) {
  if (!ms) return ''
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  if (minutes === 0) return `${seconds}s`
  return `${minutes}m ${seconds}s`
}

/**
 * Formats a future date as a human-readable "time until" string (e.g. "in 5m", "in 3h").
 * @param {Date|string|number} date - Future date value to format
 * @returns {string} Relative time string, or "now" if the date is in the past
 */
export function timeUntil(date) {
  if (!date) return ''
  if (!(date instanceof Date)) date = new Date(date)
  const diff = date.getTime() - Date.now()
  if (diff <= 0) return 'now'
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (minutes < 60) return `in ${minutes}m`
  if (hours < 24) return `in ${hours}h`
  if (days < 7) return `in ${days}d`
  return date.toLocaleDateString()
}
