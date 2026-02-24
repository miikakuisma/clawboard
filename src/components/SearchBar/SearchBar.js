import { html } from '@/utils/html.js'
import { icons } from '@/utils/icons.js'
import './SearchBar.css'

/**
 * Debounced search input that dispatches `search-change` events.
 * Fires after 250ms of inactivity with `{ query: string }` in the detail.
 * Accepts a `placeholder` attribute.
 * @extends HTMLElement
 * @fires search-change
 */
export class SearchBar extends HTMLElement {
  /** @override */
  connectedCallback() {
    this.render()
    this._debounceTimer = null
    const input = this.querySelector('.search-input')
    input.addEventListener('input', (e) => {
      clearTimeout(this._debounceTimer)
      this._debounceTimer = setTimeout(() => {
        this.dispatchEvent(new CustomEvent('search-change', { detail: { query: e.target.value }, bubbles: true }))
      }, 250)
    })
  }

  /** @override */
  disconnectedCallback() {
    clearTimeout(this._debounceTimer)
  }

  render() {
    const placeholder = this.getAttribute('placeholder') || 'Search...'
    this.innerHTML = html`
      <div class="search-wrapper">
        <span class="search-icon">${icons.search}</span>
        <input type="text" class="search-input" placeholder="${placeholder}" />
      </div>
    `
  }
}
