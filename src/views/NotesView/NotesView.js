import { store } from '@/Store.js'
import { api } from '@/services/api.js'
import { html } from '@/utils/html.js'
import { icons } from '@/utils/icons.js'
import { relativeTime } from '@/utils/formatters.js'
import './NotesView.css'

export class NotesView extends HTMLElement {
  connectedCallback() {
    this._lastDataJSON = null
    this.render()
    this._loadData()

    this.querySelector('[data-action="new-note"]')?.addEventListener('click', async () => {
      await api.createNote()
      await this._loadData()
    })

    this._unsubscribe = store.subscribe(() => {
      const { notes } = store.getState()
      const json = JSON.stringify(notes.items)
      if (json === this._lastDataJSON) return
      this._lastDataJSON = json
      this._renderNotes(notes.items)
    })
  }

  disconnectedCallback() {
    if (this._unsubscribe) this._unsubscribe()
  }

  async _loadData() {
    store.setSectionData('notes', { loading: true })
    const items = await api.getNotes()
    store.setSectionData('notes', { items, loading: false })
    this._renderNotes(items)
  }

  _renderNotes(items) {
    const list = this.querySelector('.notes-list')
    if (!list) return

    list.innerHTML = items.map(item => html`
      <div class="card note-card">
        <h3 class="note-title">${item.title}</h3>
        <p class="note-preview">${item.preview}</p>
        <div class="note-footer">
          <span>${relativeTime(item.updatedAt)}</span>
          <span>${item.wordCount} words</span>
        </div>
      </div>
    `).join('')
  }

  render() {
    this.innerHTML = html`
      <div class="page-header">
        <span class="page-header-icon">${icons.notes}</span>
        <div class="page-header-text">
          <h1>Notes</h1>
          <p>Personal notes and quick thoughts</p>
        </div>
        <div class="page-header-actions">
          <button class="btn btn-primary" data-action="new-note">
            ${icons.plus} New Note
          </button>
        </div>
      </div>

      <div class="notes-list"></div>
    `
  }
}
