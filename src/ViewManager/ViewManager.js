import { store } from '@/Store.js'

/**
 * Initializes the view manager. Subscribes to store changes and toggles
 * visibility of `.view` elements inside `.main-content`, ensuring only
 * the active view is shown. Calls `onActivate()` on the view element if defined.
 */
export function initViewManager() {
  let previousView = null

  async function renderView() {
    const state = store.getState()
    const { currentView: viewName } = state

    if (viewName === previousView) {
      return
    }

    const container = document.querySelector('.main-content')
    if (!container) return

    const viewElement = container.querySelector(`.view.${viewName}`)
    if (viewElement) {
      container.querySelectorAll('.view').forEach((el) => {
        el.hidden = true
      })
      viewElement.hidden = false
      if (typeof viewElement.onActivate === 'function') {
        viewElement.onActivate()
      }
    }
    previousView = viewName
  }

  store.subscribe(renderView)
  renderView()
}
