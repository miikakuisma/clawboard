import { describe, it, expect } from 'vitest'
import { html, raw, escapeHtml, sanitizeUrl } from './html.js'

describe('escapeHtml', () => {
  it('escapes &, <, >, ", \'', () => {
    expect(escapeHtml('&<>"\''))
      .toBe('&amp;&lt;&gt;&quot;&#39;')
  })

  it('passes through safe strings unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
  })

  it('coerces numbers to string', () => {
    expect(escapeHtml(42)).toBe('42')
  })
})

describe('raw', () => {
  it('wraps a string for unescaped interpolation', () => {
    const r = raw('<b>bold</b>')
    expect(String(r)).toBe('<b>bold</b>')
  })

  it('returns empty string for null/undefined', () => {
    expect(String(raw(null))).toBe('')
    expect(String(raw(undefined))).toBe('')
  })
})

describe('sanitizeUrl', () => {
  it('allows http URLs', () => {
    expect(sanitizeUrl('http://example.com')).toBe('http://example.com')
  })

  it('allows https URLs', () => {
    expect(sanitizeUrl('https://example.com/path')).toBe('https://example.com/path')
  })

  it('blocks javascript: URLs', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('#')
  })

  it('blocks data: URLs', () => {
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('#')
  })

  it('returns # for invalid URLs', () => {
    expect(sanitizeUrl('not a url')).toBe('#')
  })

  it('returns # for empty/falsy input', () => {
    expect(sanitizeUrl('')).toBe('#')
    expect(sanitizeUrl(null)).toBe('#')
    expect(sanitizeUrl(undefined)).toBe('#')
  })
})

describe('html', () => {
  it('returns tagged result with toString()', () => {
    expect(String(html`<div>hello</div>`)).toBe('<div>hello</div>')
  })

  it('escapes interpolated string values', () => {
    const userInput = '<script>alert("xss")</script>'
    expect(String(html`<p>${userInput}</p>`))
      .toBe('<p>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</p>')
  })

  it('escapes special chars in attribute values', () => {
    const value = '" onclick="alert(1)'
    expect(String(html`<div class="${value}">test</div>`))
      .toBe('<div class="&quot; onclick=&quot;alert(1)">test</div>')
  })

  it('interpolates numbers (escaped as string)', () => {
    expect(String(html`<span>${42}</span>`)).toBe('<span>42</span>')
  })

  it('strips undefined values', () => {
    expect(String(html`<p>${undefined}</p>`)).toBe('<p></p>')
  })

  it('strips null values', () => {
    expect(String(html`<p>${null}</p>`)).toBe('<p></p>')
  })

  it('does not escape raw() values', () => {
    const svg = '<svg><path d="M0 0"/></svg>'
    expect(String(html`<span>${raw(svg)}</span>`))
      .toBe('<span><svg><path d="M0 0"/></svg></span>')
  })

  it('does not double-escape nested html`` calls', () => {
    const inner = html`<em>nested</em>`
    expect(String(html`<div>${inner}</div>`))
      .toBe('<div><em>nested</em></div>')
  })

  it('handles arrays of raw values', () => {
    const items = [raw('<li>a</li>'), raw('<li>b</li>')]
    expect(String(html`<ul>${items}</ul>`))
      .toBe('<ul><li>a</li><li>b</li></ul>')
  })

  it('escapes plain strings in arrays', () => {
    const items = ['<b>xss</b>', 'safe']
    expect(String(html`<p>${items}</p>`))
      .toBe('<p>&lt;b&gt;xss&lt;/b&gt;safe</p>')
  })

  it('handles mixed raw and plain values in arrays', () => {
    const items = [raw('<b>bold</b>'), '<script>']
    expect(String(html`<div>${items}</div>`))
      .toBe('<div><b>bold</b>&lt;script&gt;</div>')
  })

  it('handles empty array', () => {
    expect(String(html`<ul>${[]}</ul>`)).toBe('<ul></ul>')
  })

  it('handles multiple interpolations', () => {
    const cls = 'active'
    const text = 'Click me'
    expect(String(html`<button class="${cls}">${text}</button>`))
      .toBe('<button class="active">Click me</button>')
  })

  it('auto-coerces to string for innerHTML assignment', () => {
    const result = html`<div>test</div>`
    // toString() should work for innerHTML
    expect(`${result}`).toBe('<div>test</div>')
  })
})
