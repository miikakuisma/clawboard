import { html } from '@/utils/html.js'
import { store } from '@/Store.js'
import './SetupModal.css'

const STEPS_INSTALL = ['Deploying worker', 'Setting up API key', 'Done']
const STEPS_UPDATE = ['Updating worker', 'Verifying', 'Done']

/**
 * Full-screen modal that handles initial worker deployment ("install" mode)
 * or in-place updates ("update" mode). Shows step progress, error states,
 * and a success screen with copyable credentials.
 * @extends HTMLElement
 */
export class SetupModal extends HTMLElement {
  /** @override */
  connectedCallback() {
    this._mode = this.getAttribute('mode') || 'install'
    this._step = -1
    this._error = null
    this._done = false
    this._credentials = null
    this._resolve = null
    this._promise = new Promise(resolve => { this._resolve = resolve })

    this.render()

    if (this._mode === 'update') {
      this._runUpdate()
    }
  }

  /**
   * Returns a promise that resolves when the modal finishes (install or update complete).
   * @returns {Promise<void>}
   */
  waitForComplete() {
    return this._promise
  }

  /** Deploys the worker, progresses through steps, and shows credentials on success. @private */
  async _runInstall() {
    this._error = null
    try {
      const deploy = await import('@/services/WorkerDeployService.js')

      this._step = 0
      this.render()
      const result = await deploy.deploy()

      this._step = 1
      this.render()

      // Brief pause so user sees progress
      await new Promise(r => setTimeout(r, 500))

      this._step = 2
      this.render()

      await new Promise(r => setTimeout(r, 800))

      // Show success screen with credentials
      this._credentials = result
      this._done = true
      this.render()
    } catch (err) {
      this._error = err.message || 'Deployment failed'
      this._step = -1
      this.render()
    }
  }

  /** Updates an existing worker deployment and auto-closes on success. @private */
  async _runUpdate() {
    this._error = null
    this._step = 0
    this.render()

    try {
      const deploy = await import('@/services/WorkerDeployService.js')
      await deploy.update()

      this._step = 1
      this.render()
      await new Promise(r => setTimeout(r, 500))

      this._step = 2
      this.render()
      await new Promise(r => setTimeout(r, 800))
      this._finish()
    } catch (err) {
      console.log(err)
      this._error = 'Update failed. Your dashboard still works with the previous version.'
      this._step = -1
      this.render()
    }
  }

  /** Removes the modal from the DOM and resolves the completion promise. @private */
  _finish() {
    this.remove()
    this._resolve?.()
  }

  /** Closes the modal and navigates to the Settings view for manual configuration. @private */
  _manualInstall() {
    this.remove()
    this._resolve?.()
    setTimeout(() => store.navigateToView('SettingsPanel'), 0)
  }

  /**
   * Builds the onboarding message to paste into an AI agent chat.
   * @returns {string}
   * @private
   */
  _getAgentMessage() {
    return `I've set up a Clawboard dashboard where we can collaborate on tasks. Visit the URL below to start your onboarding — it will walk you through how to use the API.\n\nWorker URL: ${this._credentials.url}\nAPI Key: ${this._credentials.apiKey}`
  }

  /** Copies the agent onboarding message to the clipboard. @private */
  async _copyMessage() {
    await navigator.clipboard.writeText(this._getAgentMessage())
    const btn = this.querySelector('#setup-copy-msg-btn')
    const orig = btn.textContent
    btn.textContent = 'Copied!'
    setTimeout(() => btn.textContent = orig, 1500)
  }

  /**
   * Renders the step indicators (done, active, or pending).
   * @param {string[]} steps - Step labels.
   * @returns {string} HTML string
   * @private
   */
  _renderSteps(steps) {
    return steps.map((label, i) => {
      let cls = 'setup-step'
      let icon = '\u25CB' // circle outline
      if (i < this._step) {
        cls += ' done'
        icon = '\u2713' // checkmark
      } else if (i === this._step) {
        cls += ' active'
        icon = '\u25CF' // filled circle
      }
      return html`<div class="${cls}">
        <span class="setup-step-icon">${icon}</span>
        <span>${label}</span>
      </div>`
    }).join('')
  }

  /** Renders the modal card with progress steps or the initial install/retry button. */
  render() {
    if (this._done && this._credentials) {
      this._renderSuccess()
      return
    }

    const isInstall = this._mode === 'install'
    const steps = isInstall ? STEPS_INSTALL : STEPS_UPDATE
    const started = this._step >= 0

    this.innerHTML = html`
      <div class="setup-modal-card">
        <div class="setup-modal-icon">${isInstall ? '\u{1F980}' : '\u{1F504}'}</div>
        <h2>${isInstall ? 'Welcome to Clawboard' : 'Updating Clawboard'}</h2>
        <p>${isInstall
          ? 'Quick install deploys automatically, or configure manually in Settings.'
          : 'A new version is available. Updating your worker now...'
        }</p>

        ${this._error ? html`<div class="setup-error">${this._error}</div>` : ''}

        ${started || this._error ? html`
          <div class="setup-modal-steps">
            ${this._renderSteps(steps)}
          </div>
        ` : ''}

        ${isInstall && !started ? html`
          <div class="setup-actions">
            <button class="btn btn-primary" id="setup-install-btn">Quick Install</button>
            <button class="btn btn-secondary" id="setup-manual-btn">Manual Install</button>
          </div>
        ` : ''}

        ${this._error ? html`
          <button class="btn btn-primary" id="setup-retry-btn">Retry</button>
          ${this._mode === 'update' ? html`<button class="btn btn-secondary" id="setup-skip-btn">Skip for now</button>` : ''}
        ` : ''}
      </div>
    `

    this.querySelector('#setup-install-btn')?.addEventListener('click', () => this._runInstall())
    this.querySelector('#setup-manual-btn')?.addEventListener('click', () => this._manualInstall())
    this.querySelector('#setup-retry-btn')?.addEventListener('click', () => {
      if (isInstall) this._runInstall()
      else this._runUpdate()
    })
    this.querySelector('#setup-skip-btn')?.addEventListener('click', () => this._finish())
  }

  /** Renders the success screen with the copyable agent message and continue button. @private */
  _renderSuccess() {
    this.innerHTML = html`
      <div class="setup-modal-card setup-modal-card--wide">
        <div class="setup-modal-icon">\u2705</div>
        <h2>You're all set!</h2>
        <p>Copy the message below and paste it to your AI agent to get started.</p>

        <div class="setup-agent-message">
          <pre>${this._getAgentMessage()}</pre>
        </div>

        <div class="setup-actions">
          <button class="btn btn-primary" id="setup-copy-msg-btn">Copy Message</button>
          <button class="btn btn-secondary" id="setup-continue-btn">Continue to Dashboard</button>
        </div>
      </div>
    `

    this.querySelector('#setup-continue-btn').addEventListener('click', () => this._finish())
    this.querySelector('#setup-copy-msg-btn').addEventListener('click', () => this._copyMessage())
  }
}
