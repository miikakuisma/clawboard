import { store } from '@/Store.js'
import { api } from '@/services/api.js'
import { html, raw } from '@/utils/html.js'
import { icons } from '@/utils/icons.js'
import { relativeTime } from '@/utils/formatters.js'
import './AiToolsView.css'

const TYPE_META = {
  img2txt:    { label: 'Image Analysis', icon: 'image' },
  txt2img:    { label: 'Image Gen',      icon: 'image' },
  txt2speech: { label: 'Text to Speech', icon: 'audio' },
  speech2txt: { label: 'Transcription',  icon: 'mic' },
}

export class AiToolsView extends HTMLElement {
  connectedCallback() {
    this._expandedId = null
    this.render()
    this._unsubscribe = store.subscribe(() => this._onStateChange())
    this.addEventListener('click', this._handleClick.bind(this))
  }

  disconnectedCallback() {
    this._unsubscribe?.()
  }

  onActivate() {
    this._loadLogs()
  }

  async _loadLogs() {
    store.setSectionData('aiTools', { loading: true })
    try {
      const logs = await api.getAiLogs()
      store.setSectionData('aiTools', { logs, loading: false })
    } catch (e) {
      console.warn('[AiTools] Failed to load logs:', e.message)
      store.setSectionData('aiTools', { loading: false })
    }
  }

  _onStateChange() {
    const { aiTools } = store.getState()
    this._renderContent(aiTools)
  }

  _handleClick(e) {
    // Clear logs
    if (e.target.closest('.ai-tools-clear-btn')) {
      this._clearLogs()
      return
    }
    // Toggle log item expand
    const logItem = e.target.closest('.ai-log-item')
    if (logItem) {
      const id = logItem.dataset.logId
      this._expandedId = this._expandedId === id ? null : id
      const { aiTools } = store.getState()
      this._renderContent(aiTools)
    }
  }

  async _clearLogs() {
    try {
      await api.deleteAiLogs()
      store.setSectionData('aiTools', { logs: [] })
    } catch (e) {
      console.warn('[AiTools] Failed to clear logs:', e.message)
    }
  }

  render() {
    this.innerHTML = html`
      <div class="ai-tools-view">
        <div class="ai-tools-header">
          <h2>AI Tools</h2>
          <button class="ai-tools-clear-btn">Clear Logs</button>
        </div>
        <div id="ai-tools-content"></div>
      </div>
    `
    const { aiTools } = store.getState()
    this._renderContent(aiTools)
  }

  _renderContent({ logs, loading }) {
    const container = this.querySelector('#ai-tools-content')
    if (!container) return

    if (loading && (!logs || logs.length === 0)) {
      container.innerHTML = html`<div class="ai-empty-state"><p>Loading...</p></div>`
      return
    }

    if (!logs || logs.length === 0) {
      container.innerHTML = html`
        <div class="ai-empty-state">
          <div class="ai-empty-icon">${raw(icons.ai)}</div>
          <p>No AI activity yet</p>
          <p style="margin-top:8px;font-size:0.8rem;opacity:0.7">
            Agents can use the AI proxy endpoints to analyze images, generate images, convert text to speech, and transcribe audio.
          </p>
        </div>
      `
      return
    }

    // Summary counts
    const counts = { img2txt: 0, txt2img: 0, txt2speech: 0, speech2txt: 0 }
    for (const log of logs) {
      if (counts[log.type] !== undefined) counts[log.type]++
    }

    const summaryHtml = html`
      <div class="ai-summary">
        <div class="ai-summary-card">
          <div class="ai-summary-count">${logs.length}</div>
          <div class="ai-summary-label">Total Calls</div>
        </div>
        <div class="ai-summary-card">
          <div class="ai-summary-count">${counts.img2txt}</div>
          <div class="ai-summary-label">Image Analysis</div>
        </div>
        <div class="ai-summary-card">
          <div class="ai-summary-count">${counts.txt2img}</div>
          <div class="ai-summary-label">Image Gen</div>
        </div>
        <div class="ai-summary-card">
          <div class="ai-summary-count">${counts.txt2speech}</div>
          <div class="ai-summary-label">Text to Speech</div>
        </div>
        <div class="ai-summary-card">
          <div class="ai-summary-count">${counts.speech2txt}</div>
          <div class="ai-summary-label">Transcription</div>
        </div>
      </div>
    `

    const logsHtml = logs.map(log => {
      const meta = TYPE_META[log.type] || { label: log.type, icon: 'ai' }
      const expanded = this._expandedId === log.id
      const time = log.createdAt ? relativeTime(new Date(log.createdAt)) : ''

      let inputText = ''
      if (log.input) {
        inputText = log.input.prompt || log.input.text || log.input.preview || ''
      }

      let outputText = ''
      if (log.output && log.output.textPreview) {
        if ((log.type === 'txt2img' || log.type === 'txt2speech') && log.filePath) {
          outputText = '' // media preview is the output
        } else {
          outputText = log.output.textPreview
        }
      }

      let previewHtml = ''
      if (log.type === 'txt2img' && log.filePath) {
        const authKey = localStorage.getItem('sb_api_key')
        const src = `${api.getAiFileUrl(log.id)}?auth=${encodeURIComponent(authKey || '')}`
        previewHtml = `<div class="ai-log-preview${expanded ? ' expanded' : ''}"><img src="${src}" alt="Generated image" onerror="this.parentElement.innerHTML='<p class=\\'ai-media-error\\'>Image unavailable</p>'" /></div>`
      } else if (log.type === 'txt2speech' && log.filePath) {
        const authKey = localStorage.getItem('sb_api_key')
        const src = `${api.getAiFileUrl(log.id)}?auth=${encodeURIComponent(authKey || '')}`
        previewHtml = `<div class="ai-log-preview"><audio controls src="${src}"></audio></div>`
      }

      return html`
        <div class="ai-log-item ${expanded ? 'expanded' : ''}" data-log-id="${log.id}">
          <div class="ai-log-item-header">
            <span class="ai-log-type-badge">${raw(icons[meta.icon])} ${meta.label}</span>
            <span class="ai-log-time">${time}</span>
            <span class="ai-log-expand-icon">${raw(icons[expanded ? 'chevronDown' : 'chevronRight'])}</span>
          </div>
          ${inputText ? html`<div class="ai-log-input">${inputText}</div>` : ''}
          ${outputText ? html`<div class="ai-log-output">${outputText}</div>` : ''}
          ${raw(previewHtml)}
        </div>
      `
    }).join('')

    container.innerHTML = summaryHtml + html`<div class="ai-log-list">${raw(logsHtml)}</div>`
  }
}
