import './ProgressBar.css'

/**
 * Horizontal progress bar controlled by a `progress` attribute (0-1).
 * @extends HTMLElement
 */
export class ProgressBar extends HTMLElement {
  /** @returns {string[]} */
  static get observedAttributes() {
    return ['progress']
  }

  /** @override */
  connectedCallback() {
    this.render()
  }

  /** @override */
  attributeChangedCallback() {
    if (this.isConnected) this.update()
  }

  /** Updates the fill width to match the current `progress` attribute. */
  update() {
    const fill = this.querySelector('.progress-fill')
    const track = this.querySelector('.progress-track')
    if (fill) {
      const pct = Math.round((parseFloat(this.getAttribute('progress') || 0)) * 100)
      fill.style.width = `${pct}%`
      if (track) track.setAttribute('aria-valuenow', pct)
    }
  }

  render() {
    const progress = parseFloat(this.getAttribute('progress') || 0)
    const pct = Math.round(progress * 100)
    this.innerHTML = `
      <div class="progress-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
        <div class="progress-fill" style="width: ${pct}%"></div>
      </div>
    `
  }
}
