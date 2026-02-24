import './StatusBadge.css'

const TYPE_MAP = {
  pending: { label: 'Pending', color: 'amber' },
  processing: { label: 'Processing', color: 'cyan' },
  processed: { label: 'Processed', color: 'green' },
  indexed: { label: 'Indexed', color: 'green' },
  running: { label: 'Running', color: 'cyan' },
  queued: { label: 'Queued', color: 'gray' },
  error: { label: 'Error', color: 'red' },
  high: { label: 'High', color: 'red' },
  medium: { label: 'Medium', color: 'amber' },
  low: { label: 'Low', color: 'green' },
}

/**
 * Inline badge that displays a colored label for a given status type.
 * Set the `type` attribute to one of: pending, processing, processed,
 * indexed, running, queued, error, high, medium, low.
 * @extends HTMLElement
 */
export class StatusBadge extends HTMLElement {
  /** @returns {string[]} */
  static get observedAttributes() {
    return ['type']
  }

  /** @override */
  connectedCallback() {
    this.render()
  }

  /** @override */
  attributeChangedCallback() {
    if (this.isConnected) this.render()
  }

  /** Sets the badge class and label text based on the current `type` attribute. */
  render() {
    const type = this.getAttribute('type') || 'pending'
    const info = TYPE_MAP[type] || TYPE_MAP.pending
    this.className = `status-badge badge-${info.color}`
    this.textContent = info.label
  }
}
