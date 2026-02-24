import { store } from '@/Store.js'
import { html } from '@/utils/html.js'
import { icons } from '@/utils/icons.js'
import './Sidebar.css'

const NAV_ITEMS = [
  { id: 'heartbeat', label: 'Heartbeat', icon: 'heartbeat' },
  { id: 'tasks', label: 'Tasks', icon: 'tasks' },
  { id: 'SettingsPanel', label: 'Settings', icon: 'settings' },
]

/**
 * Navigation sidebar showing the assistant avatar, nav items, and theme toggle.
 * Subscribes to the store to highlight the active view and display badge counts.
 * @extends HTMLElement
 */
export class Sidebar extends HTMLElement {
  /** @override */
  connectedCallback() {
    this.render()
    this._unsubscribe = store.subscribe(() => this.update())
    this.addEventListener('click', this._handleClick.bind(this))
  }

  /** @override */
  disconnectedCallback() {
    this._unsubscribe?.()
  }

  /**
   * Delegates click events on nav items to navigate the store.
   * @param {MouseEvent} e
   * @private
   */
  _handleClick(e) {
    const navItem = e.target.closest('[data-nav]')
    if (navItem) {
      store.navigateToView(navItem.dataset.nav)
    }
  }

  /** Synchronizes active nav item and badge counts with current store state. */
  update() {
    const { currentView } = store.getState()
    const badges = store.getBadgeCounts()

    this.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.nav === currentView)
    })

    // Update tasks badge
    const badge = this.querySelector('[data-badge="tasks"]')
    if (badge) {
      badge.textContent = badges.tasks
      badge.hidden = badges.tasks === 0
    }

    // Update tasks spinner
    const spinner = this.querySelector('[data-spinner="tasks"]')
    if (spinner) {
      spinner.hidden = !badges.tasksRunning
    }
  }

  /** Renders the full sidebar: avatar header, nav buttons, and footer. */
  render() {
    const { currentView, assistant } = store.getState()
    const badges = store.getBadgeCounts()

    this.innerHTML = html`
      <div class="sidebar-header">
        <div class="assistant-avatar">
          <div class="avatar-circle" style="background-color: ${assistant.color}">
            ${assistant.avatar ? 
              `<img src="${assistant.avatar}" alt="${assistant.name}" class="avatar-image" />` : 
              assistant.initials
            }
          </div>
          <span class="online-dot"></span>
        </div>
        <div class="assistant-info">
          <span class="assistant-name">${assistant.name}</span>
          <span class="assistant-status">Online</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        ${NAV_ITEMS.map(item => {
          const isTask = item.id === 'tasks'
          const badgeCount = isTask ? (badges.tasks || 0) : 0
          return html`
            <button class="nav-item ${currentView === item.id ? 'active' : ''}" data-nav="${item.id}">
              <span class="nav-icon">${icons[item.icon]}</span>
              <span class="nav-label">${item.label}</span>
              ${isTask ? html`
                <span class="nav-spinner" data-spinner="tasks" ${badges.tasksRunning ? '' : 'hidden'}>${icons.spinner}</span>
                <span class="nav-badge" data-badge="tasks" ${badgeCount === 0 ? 'hidden' : ''}>${badgeCount}</span>
              ` : ''}
            </button>
          `
        }).join('')}
      </nav>

      <div class="sidebar-footer">
        <theme-toggle></theme-toggle>
        <div class="footer-text">
          <span>CLAWBOARD V0.1</span>
          <a href="https://puter.com" target="_blank" rel="noopener" class="puter-link">Powered by Puter</a>
        </div>
      </div>
    `
  }
}
