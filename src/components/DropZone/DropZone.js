import { html } from '@/utils/html.js'
import { icons } from '@/utils/icons.js'
import './DropZone.css'

/**
 * File upload component supporting drag-and-drop and click-to-browse.
 * Dispatches a `file-dropped` CustomEvent with `{ files: File[] }` on selection.
 * @extends HTMLElement
 * @fires file-dropped
 */
export class DropZone extends HTMLElement {
  /** @override */
  connectedCallback() {
    this.render()
    this._setupEvents()
  }

  /** Wires up drag/drop and click events on the drop zone area. @private */
  _setupEvents() {
    const zone = this.querySelector('.dropzone-area')
    const fileInput = this.querySelector('.dropzone-input')

    zone.addEventListener('dragover', (e) => {
      e.preventDefault()
      zone.classList.add('dragover')
    })

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('dragover')
    })

    zone.addEventListener('drop', (e) => {
      e.preventDefault()
      zone.classList.remove('dragover')
      const files = Array.from(e.dataTransfer.files)
      if (files.length) {
        this.dispatchEvent(new CustomEvent('file-dropped', { detail: { files }, bubbles: true }))
      }
    })

    zone.addEventListener('click', () => {
      fileInput.click()
    })

    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files)
      if (files.length) {
        this.dispatchEvent(new CustomEvent('file-dropped', { detail: { files }, bubbles: true }))
        fileInput.value = ''
      }
    })
  }

  render() {
    this.innerHTML = html`
      <div class="dropzone-area">
        <input type="file" class="dropzone-input" multiple hidden />
        <span class="dropzone-icon">${icons.upload}</span>
        <span class="dropzone-text">Drop files here or click to browse</span>
      </div>
    `
  }
}
