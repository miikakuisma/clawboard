/**
 * Simple template literal utility for creating HTML strings
 * @param {TemplateStringsArray} strings
 * @param {...any} values
 * @returns {string}
 */
export function html(strings, ...values) {
  return strings.reduce((result, str, i) => {
    const value = values[i]
    if (value === undefined || value === null) {
      return result + str
    }
    if (Array.isArray(value)) {
      return result + str + value.join('')
    }
    return result + str + value
  }, '')
}
