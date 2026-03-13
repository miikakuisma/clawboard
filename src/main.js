/**
 * @module main
 * Application entry point. Registers all custom elements, applies the saved
 * theme, checks for worker deployment/updates, and starts the polling service.
 */
import { initViewManager } from '@/ViewManager/ViewManager.js'
import { store } from '@/Store.js'
import { pollingService } from '@/services/PollingService.js'
import * as WorkerConfig from '@/services/WorkerConfig.js'
import '@/styles/styles.css'
import '@/ViewManager/ViewManager.css'

// Layout
import { AppShell } from '@/layout/AppShell.js'
import { Sidebar } from '@/layout/Sidebar.js'

// Views
import { TasksView } from '@/views/TasksView/TasksView.js'
import { HeartbeatView } from '@/views/HeartbeatView/HeartbeatView.js'
import { SettingsPanel } from '@/views/SettingsPanel/SettingsPanel.js'
import { AiToolsView } from '@/views/AiToolsView/AiToolsView.js'

// Shared components
import { StatusBadge } from '@/components/StatusBadge/StatusBadge.js'
import { DropZone } from '@/components/DropZone/DropZone.js'
import { SearchBar } from '@/components/SearchBar/SearchBar.js'
import { ProgressBar } from '@/components/ProgressBar/ProgressBar.js'
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle.js'
import { SetupModal } from '@/components/SetupModal/SetupModal.js'

/**
 * Shows a sign-in overlay when running outside Puter's app iframe.
 * Returns a promise that resolves with user info after successful sign-in.
 */
function showSignInOverlay() {
  const overlay = document.createElement('div')
  overlay.id = 'sign-in-overlay'
  overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:var(--color-bg,#0f1117);z-index:9999'
  overlay.innerHTML = `
    <div style="text-align:center;color:var(--color-text,#e2e8f0);font-family:system-ui,sans-serif">
      <h2 style="margin-bottom:8px">Sign In Required</h2>
      <p style="margin-bottom:24px;opacity:0.7">Sign in with your Puter account to access Clawboard.</p>
      <button id="sign-in-btn" style="padding:10px 24px;background:#6366f1;color:#fff;border:none;border-radius:8px;font-size:16px;cursor:pointer">Sign In with Puter</button>
      <p id="sign-in-error" style="margin-top:16px;color:#ef4444;display:none"></p>
    </div>
  `
  document.body.appendChild(overlay)

  return new Promise((resolve) => {
    document.getElementById('sign-in-btn').addEventListener('click', async () => {
      try {
        await window.puter.auth.signIn()
        const user = await window.puter.auth.getUser()
        overlay.remove()
        resolve(user)
      } catch (error) {
        const errEl = document.getElementById('sign-in-error')
        errEl.textContent = 'Sign-in failed. Please try again.'
        errEl.style.display = ''
        console.error('[App] Sign-in failed:', error)
      }
    })
  })
}

// Register layout
customElements.define('app-shell', AppShell)
customElements.define('app-sidebar', Sidebar)

// Register views
customElements.define('tasks-view', TasksView)
customElements.define('heartbeat-view', HeartbeatView)
customElements.define('settings-panel', SettingsPanel)
customElements.define('ai-tools-view', AiToolsView)

// Register shared components
customElements.define('status-badge', StatusBadge)
customElements.define('drop-zone', DropZone)
customElements.define('search-bar', SearchBar)
customElements.define('progress-bar', ProgressBar)
customElements.define('theme-toggle', ThemeToggle)
customElements.define('setup-modal', SetupModal)

/**
 * Bootstraps the application: hydrates from KV, fetches initial data,
 * then reveals the fully-loaded UI.
 */
async function init() {
  window.store = store

  // 1. Loading overlay is already visible from HTML

  // 2. Ensure Puter auth is ready before accessing KV/workers
  if (window.puter) {
    if (window.puter.env === 'app') {
      // Inside Puter iframe — SDK may not be ready yet, wait for auth
      try {
        await window.puter.auth.getUser()
        console.log('[App] Puter auth ready')
      } catch {
        // Auth not ready — wait and retry
        console.log('[App] Waiting for Puter auth...')
        await new Promise(r => setTimeout(r, 1000))
        try {
          await window.puter.auth.getUser()
          console.log('[App] Puter auth ready (after wait)')
        } catch (e) {
          console.warn('[App] Puter auth not available:', e?.message || e)
        }
      }
    } else {
      // Outside Puter iframe — show sign-in if needed
      if (!window.puter.auth.isSignedIn()) {
        const user = await showSignInOverlay()
        console.log('[App] User signed in:', user.username)
      } else {
        const user = await window.puter.auth.getUser()
        console.log('[App] User already signed in:', user.username)
      }
    }
  }

  // 3. Load worker config from puter.kv into memory
  const workerDeploy = await import('@/services/WorkerDeployService.js')
  await WorkerConfig.loadFromKV()

  // 4. Restore theme from KV if available
  if (typeof puter !== 'undefined' && puter.kv) {
    try {
      const kvTheme = await puter.kv.get('sb_theme')
      const themeVal = kvTheme?.value ?? kvTheme
      if (themeVal) localStorage.setItem('theme', themeVal)
    } catch { /* ignore */ }
  }
  const theme = localStorage.getItem('theme') || 'system'
  store.state.theme = theme
  if (theme && theme !== 'system') {
    document.documentElement.setAttribute('data-theme', theme)
  }

  // 5. Initialize view manager
  initViewManager()

  // 6. If not configured → show install modal
  if (!workerDeploy.isWorkerConfigured()) {
    // Hide loading overlay before showing modal
    document.getElementById('loading-overlay')?.remove()
    document.querySelector('app-shell').style.display = ''

    const modal = document.createElement('setup-modal')
    modal.setAttribute('mode', 'install')
    document.body.appendChild(modal)
    await modal.waitForComplete()
    document.querySelector('settings-panel')?.refresh()
  } else {
    // 7. Pre-load tasks + heartbeat before revealing UI
    await pollingService.fetchAll()

  }

  // 8. Refresh settings panel with restored/fetched data
  document.querySelector('settings-panel')?.refresh()

  // 9. Hide loading overlay, show app-shell
  document.getElementById('loading-overlay')?.remove()
  document.querySelector('app-shell').style.display = ''

  // 10. Start ongoing polling
  pollingService.start()
}

init()
