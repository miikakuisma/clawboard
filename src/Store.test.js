import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock localStorage before importing Store
const storage = {}
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key) => storage[key] ?? null),
  setItem: vi.fn((key, val) => { storage[key] = val }),
  removeItem: vi.fn((key) => { delete storage[key] }),
})

const { store } = await import('./Store.js')

describe('Store', () => {
  beforeEach(() => {
    // Reset to a known state
    store.setState({
      currentView: 'tasks',
      tasks: { items: [], loading: false },
      heartbeat: { data: null, loading: false },
    })
  })

  it('getState returns the current state', () => {
    const state = store.getState()
    expect(state).toHaveProperty('currentView')
    expect(state).toHaveProperty('tasks')
    expect(state).toHaveProperty('heartbeat')
  })

  it('setState merges new values into state', () => {
    store.setState({ currentView: 'settings' })
    expect(store.getState().currentView).toBe('settings')
    // Other state is preserved
    expect(store.getState().tasks).toBeDefined()
  })

  it('setState notifies subscribers', () => {
    const listener = vi.fn()
    store.subscribe(listener)

    store.setState({ currentView: 'heartbeat' })

    expect(listener).toHaveBeenCalled()
  })

  it('subscribe returns an unsubscribe function', () => {
    const listener = vi.fn()
    const unsub = store.subscribe(listener)

    unsub()
    store.setState({ currentView: 'settings' })

    expect(listener).not.toHaveBeenCalled()
  })

  describe('getBadgeCounts', () => {
    it('returns zero counts with no tasks', () => {
      store.setState({ tasks: { items: [] } })
      const counts = store.getBadgeCounts()
      expect(counts.tasks).toBe(0)
      expect(counts.tasksRunning).toBe(false)
    })

    it('counts pending tasks', () => {
      store.setState({
        tasks: {
          items: [
            { id: '1', status: 'pending' },
            { id: '2', status: 'pending' },
            { id: '3', status: 'completed' },
          ],
        },
      })
      expect(store.getBadgeCounts().tasks).toBe(2)
    })

    it('detects in_progress tasks', () => {
      store.setState({
        tasks: {
          items: [
            { id: '1', status: 'in_progress' },
            { id: '2', status: 'pending' },
          ],
        },
      })
      expect(store.getBadgeCounts().tasksRunning).toBe(true)
    })

    it('handles non-array tasks.items gracefully', () => {
      store.setState({ tasks: { items: null } })
      const counts = store.getBadgeCounts()
      expect(counts.tasks).toBe(0)
      expect(counts.tasksRunning).toBe(false)
    })
  })

  describe('navigateToView', () => {
    it('changes the current view', () => {
      store.navigateToView('settings')
      expect(store.getState().currentView).toBe('settings')
    })

    it('does not emit if view is unchanged', () => {
      store.navigateToView('tasks')
      const listener = vi.fn()
      store.subscribe(listener)

      store.navigateToView('tasks')

      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('setSectionData', () => {
    it('merges data into a section', () => {
      store.setSectionData('tasks', { loading: true })
      const state = store.getState()
      expect(state.tasks.loading).toBe(true)
      expect(state.tasks.items).toEqual([])
    })
  })

  describe('assistant profile', () => {
    it('getAssistantProfile returns the profile', () => {
      const profile = store.getAssistantProfile()
      expect(profile).toHaveProperty('name')
      expect(profile).toHaveProperty('initials')
    })

    it('updateAssistantProfile merges updates', () => {
      store.updateAssistantProfile({ name: 'TestBot' })
      expect(store.getAssistantProfile().name).toBe('TestBot')
      // Other fields preserved
      expect(store.getAssistantProfile().initials).toBeDefined()
    })

    it('resetAssistantProfile restores defaults', () => {
      store.updateAssistantProfile({ name: 'Custom' })
      store.resetAssistantProfile()
      expect(store.getAssistantProfile().name).toBe('Nova')
    })
  })
})
