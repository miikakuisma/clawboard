import { store } from '@/Store.js'
import { html } from '@/utils/html.js'
import { icons } from '@/utils/icons.js'
import './ThemeToggle.css'

const THEME_CYCLE = ['system', 'light', 'dark']
const THEME_LABELS = { system: 'System', light: 'Light', dark: 'Dark' }
const THEME_ICONS = { system: 'monitor', light: 'sun', dark: 'moon' }

/**
 * Button that cycles the theme through system -> light -> dark.
 * Updates the `data-theme` attribute on `<html>` and persists the choice in the store.
 * @extends HTMLElement
 */
export class ThemeToggle extends HTMLElement {
  /** @override */
  connectedCallback() {
    this.render()
    this.addEventListener('click', this._handleClick.bind(this))
    this._unsubscribe = store.subscribe(() => this.render())
  }

  /** @override */
  disconnectedCallback() {
    this._unsubscribe?.()
  }

  /** Advances the theme to the next value in the cycle and applies it. @private */
  _handleClick() {
    const { theme } = store.getState()
    const idx = THEME_CYCLE.indexOf(theme)
    const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]
    store.setTheme(next)

    if (next === 'system') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', next)
    }
  }

  render() {
    const { theme } = store.getState()
    const icon = THEME_ICONS[theme] || 'monitor'
    const label = THEME_LABELS[theme] || 'System'
    this.innerHTML = html`
      <button class="theme-toggle-btn" title="Toggle theme">
        <span class="theme-icon" title="Colors: ${label}">${icons[icon]}</span>
      </button>
    `
  }
}
