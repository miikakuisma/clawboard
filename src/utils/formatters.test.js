import { describe, it, expect, vi, afterEach } from 'vitest'
import { relativeTime, formatFileSize, formatDuration, timeUntil } from './formatters.js'

describe('relativeTime', () => {
  afterEach(() => { vi.useRealTimers() })

  it('returns empty string for falsy input', () => {
    expect(relativeTime(null)).toBe('')
    expect(relativeTime(undefined)).toBe('')
    expect(relativeTime('')).toBe('')
  })

  it('returns "just now" for less than 60 seconds ago', () => {
    vi.useFakeTimers({ now: new Date('2025-01-01T12:01:00Z') })
    expect(relativeTime(new Date('2025-01-01T12:00:30Z'))).toBe('just now')
  })

  it('returns minutes ago', () => {
    vi.useFakeTimers({ now: new Date('2025-01-01T12:05:00Z') })
    expect(relativeTime(new Date('2025-01-01T12:00:00Z'))).toBe('5m ago')
  })

  it('returns hours ago', () => {
    vi.useFakeTimers({ now: new Date('2025-01-01T15:00:00Z') })
    expect(relativeTime(new Date('2025-01-01T12:00:00Z'))).toBe('3h ago')
  })

  it('returns days ago', () => {
    vi.useFakeTimers({ now: new Date('2025-01-04T12:00:00Z') })
    expect(relativeTime(new Date('2025-01-01T12:00:00Z'))).toBe('3d ago')
  })

  it('returns locale date string for 7+ days ago', () => {
    vi.useFakeTimers({ now: new Date('2025-01-10T12:00:00Z') })
    const date = new Date('2025-01-01T12:00:00Z')
    expect(relativeTime(date)).toBe(date.toLocaleDateString())
  })

  it('accepts ISO string input', () => {
    vi.useFakeTimers({ now: new Date('2025-01-01T12:05:00Z') })
    expect(relativeTime('2025-01-01T12:00:00Z')).toBe('5m ago')
  })

  it('accepts timestamp input', () => {
    const now = new Date('2025-01-01T12:05:00Z')
    vi.useFakeTimers({ now })
    const fiveMinAgo = now.getTime() - 5 * 60 * 1000
    expect(relativeTime(fiveMinAgo)).toBe('5m ago')
  })
})

describe('formatFileSize', () => {
  it('formats zero bytes', () => {
    expect(formatFileSize(0)).toBe('0 B')
  })

  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 B')
  })

  it('formats kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB')
    expect(formatFileSize(1536)).toBe('1.5 KB')
  })

  it('formats megabytes', () => {
    expect(formatFileSize(1048576)).toBe('1.0 MB')
  })

  it('formats gigabytes', () => {
    expect(formatFileSize(1073741824)).toBe('1.0 GB')
  })
})

describe('formatDuration', () => {
  it('returns empty string for falsy input', () => {
    expect(formatDuration(0)).toBe('')
    expect(formatDuration(null)).toBe('')
    expect(formatDuration(undefined)).toBe('')
  })

  it('formats seconds only', () => {
    expect(formatDuration(5000)).toBe('5s')
    expect(formatDuration(45000)).toBe('45s')
  })

  it('formats minutes and seconds', () => {
    expect(formatDuration(90000)).toBe('1m 30s')
    expect(formatDuration(150000)).toBe('2m 30s')
  })

  it('formats exact minutes', () => {
    expect(formatDuration(60000)).toBe('1m 0s')
    expect(formatDuration(120000)).toBe('2m 0s')
  })
})

describe('timeUntil', () => {
  afterEach(() => { vi.useRealTimers() })

  it('returns empty string for falsy input', () => {
    expect(timeUntil(null)).toBe('')
    expect(timeUntil(undefined)).toBe('')
    expect(timeUntil('')).toBe('')
  })

  it('returns "now" for past dates', () => {
    vi.useFakeTimers({ now: new Date('2025-01-01T12:05:00Z') })
    expect(timeUntil(new Date('2025-01-01T12:00:00Z'))).toBe('now')
  })

  it('returns minutes until', () => {
    vi.useFakeTimers({ now: new Date('2025-01-01T12:00:00Z') })
    expect(timeUntil(new Date('2025-01-01T12:30:00Z'))).toBe('in 30m')
  })

  it('returns hours until', () => {
    vi.useFakeTimers({ now: new Date('2025-01-01T12:00:00Z') })
    expect(timeUntil(new Date('2025-01-01T15:00:00Z'))).toBe('in 3h')
  })

  it('returns days until', () => {
    vi.useFakeTimers({ now: new Date('2025-01-01T12:00:00Z') })
    expect(timeUntil(new Date('2025-01-04T12:00:00Z'))).toBe('in 3d')
  })

  it('returns locale date string for 7+ days', () => {
    vi.useFakeTimers({ now: new Date('2025-01-01T12:00:00Z') })
    const date = new Date('2025-01-10T12:00:00Z')
    expect(timeUntil(date)).toBe(date.toLocaleDateString())
  })

  it('accepts ISO string input', () => {
    vi.useFakeTimers({ now: new Date('2025-01-01T12:00:00Z') })
    expect(timeUntil('2025-01-01T12:30:00Z')).toBe('in 30m')
  })
})
