import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from './EventEmitter.js'

describe('EventEmitter', () => {
  it('starts with zero listeners', () => {
    const emitter = new EventEmitter()
    expect(emitter.getListenerCount()).toBe(0)
  })

  it('subscribe adds a listener', () => {
    const emitter = new EventEmitter()
    emitter.subscribe(() => {})
    expect(emitter.getListenerCount()).toBe(1)
  })

  it('emit calls all listeners', () => {
    const emitter = new EventEmitter()
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    emitter.subscribe(fn1)
    emitter.subscribe(fn2)

    emitter.emit()

    expect(fn1).toHaveBeenCalledOnce()
    expect(fn2).toHaveBeenCalledOnce()
  })

  it('unsubscribe removes the listener', () => {
    const emitter = new EventEmitter()
    const fn = vi.fn()
    const unsub = emitter.subscribe(fn)

    unsub()
    emitter.emit()

    expect(fn).not.toHaveBeenCalled()
    expect(emitter.getListenerCount()).toBe(0)
  })

  it('unsubscribe only removes the specific listener', () => {
    const emitter = new EventEmitter()
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    const unsub1 = emitter.subscribe(fn1)
    emitter.subscribe(fn2)

    unsub1()
    emitter.emit()

    expect(fn1).not.toHaveBeenCalled()
    expect(fn2).toHaveBeenCalledOnce()
  })

  it('clear removes all listeners', () => {
    const emitter = new EventEmitter()
    emitter.subscribe(() => {})
    emitter.subscribe(() => {})
    emitter.subscribe(() => {})

    emitter.clear()

    expect(emitter.getListenerCount()).toBe(0)
  })

  it('emit with no listeners does not throw', () => {
    const emitter = new EventEmitter()
    expect(() => emitter.emit()).not.toThrow()
  })
})
