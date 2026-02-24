import { html } from '@/utils/html.js'
import './AppShell.css'

/**
 * Root layout component that contains the sidebar and main content area.
 * Each view is rendered inside a hidden `<div>` and toggled by the ViewManager.
 * @extends HTMLElement
 */
export class AppShell extends HTMLElement {
  /** @override */
  connectedCallback() {
    this.render()
  }

  /** Renders the sidebar and the three view containers (tasks, heartbeat, settings). */
  render() {
    this.innerHTML = html`
      <app-sidebar></app-sidebar>
      <main class="main-content">
        <div class="view tasks" hidden>
          <tasks-view></tasks-view>
        </div>
        <div class="view heartbeat" hidden>
          <heartbeat-view></heartbeat-view>
        </div>
        <div class="view SettingsPanel" hidden>
          <test-panel></test-panel>
        </div>
      </main>
    `
  }
}
