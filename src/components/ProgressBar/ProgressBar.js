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
    if (fill) {
      fill.style.width = `${(parseFloat(this.getAttribute('progress') || 0)) * 100}%`
    }
  }

  render() {
    const progress = parseFloat(this.getAttribute('progress') || 0)
    this.innerHTML = `
      <div class="progress-track">
        <div class="progress-fill" style="width: ${progress * 100}%"></div>
      </div>
    `
  }
}
