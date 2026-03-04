/** @type {symbol} Marker for pre-escaped HTML content */
const RAW_HTML = Symbol('raw')

/**
 * Escapes HTML special characters to prevent XSS.
 * @param {*} str - Value to escape (coerced to string)
 * @returns {string}
 */
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Wraps a value so html() won't escape it. Use for trusted HTML like SVG icons.
 * @param {*} value
 * @returns {{ [RAW_HTML]: string, toString(): string }}
 */
export function raw(value) {
  if (value === undefined || value === null) return { [RAW_HTML]: '', toString() { return '' } }
  const s = String(value)
  return { [RAW_HTML]: s, toString() { return s } }
}

/**
 * Sanitizes a URL to only allow http/https protocols. Blocks javascript:, data:, etc.
 * @param {string} url
 * @returns {string} The original URL if safe, or '#' if unsafe
 */
export function sanitizeUrl(url) {
  if (!url) return '#'
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol) ? url : '#'
  } catch {
    return '#'
  }
}

/**
 * Tagged template literal for HTML strings with automatic XSS escaping.
 * Plain interpolated values are HTML-escaped. Use raw() or nested html``
 * calls for trusted HTML that should not be escaped.
 * @param {TemplateStringsArray} strings
 * @param {...any} values
 * @returns {{ [RAW_HTML]: string, toString(): string }}
 */
export function html(strings, ...values) {
  const result = strings.reduce((acc, str, i) => {
    const value = values[i]
    if (value === undefined || value === null) return acc + str
    // Already-escaped raw HTML (from raw() or nested html``)
    if (value && value[RAW_HTML] !== undefined) return acc + str + value[RAW_HTML]
    // Array of values
    if (Array.isArray(value)) {
      return acc + str + value.map(v =>
        v && v[RAW_HTML] !== undefined ? v[RAW_HTML] : escapeHtml(v)
      ).join('')
    }
    // Plain value — escape it
    return acc + str + escapeHtml(value)
  }, '')
  return { [RAW_HTML]: result, toString() { return result } }
}
