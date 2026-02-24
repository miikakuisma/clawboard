import { describe, it, expect } from 'vitest'
import { html } from './html.js'

describe('html', () => {
  it('returns a plain string with no interpolation', () => {
    expect(html`<div>hello</div>`).toBe('<div>hello</div>')
  })

  it('interpolates string values', () => {
    const name = 'world'
    expect(html`<p>${name}</p>`).toBe('<p>world</p>')
  })

  it('interpolates number values', () => {
    expect(html`<span>${42}</span>`).toBe('<span>42</span>')
  })

  it('strips undefined values', () => {
    expect(html`<p>${undefined}</p>`).toBe('<p></p>')
  })

  it('strips null values', () => {
    expect(html`<p>${null}</p>`).toBe('<p></p>')
  })

  it('joins array values', () => {
    const items = ['<li>a</li>', '<li>b</li>', '<li>c</li>']
    expect(html`<ul>${items}</ul>`).toBe('<ul><li>a</li><li>b</li><li>c</li></ul>')
  })

  it('handles multiple interpolations', () => {
    const cls = 'active'
    const text = 'Click me'
    expect(html`<button class="${cls}">${text}</button>`)
      .toBe('<button class="active">Click me</button>')
  })

  it('handles empty array', () => {
    expect(html`<ul>${[]}</ul>`).toBe('<ul></ul>')
  })
})
