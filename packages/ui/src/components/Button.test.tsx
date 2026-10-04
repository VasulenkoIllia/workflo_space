import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from './Button.js'

describe('Button', () => {
  it('renders its label', () => {
    render(<Button>Зберегти</Button>)
    expect(screen.getByRole('button', { name: 'Зберегти' })).toBeInTheDocument()
  })

  it('applies variant + size + base classes', () => {
    render(
      <Button variant="primary" size="sm">
        x
      </Button>
    )
    expect(screen.getByRole('button')).toHaveClass('wfp-btn', 'wfp-btn--primary', 'wfp-btn--sm')
  })

  it('defaults to the secondary (base) variant with no modifier class', () => {
    render(<Button>x</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toHaveClass('wfp-btn')
    expect(btn.className).not.toMatch(/wfp-btn--(primary|ghost|danger)/)
  })

  it('calls onClick when pressed', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>go</Button>)
    screen.getByRole('button').click()
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not fire onClick when disabled', () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        go
      </Button>
    )
    screen.getByRole('button').click()
    expect(onClick).not.toHaveBeenCalled()
  })

  it('blocks interaction and exposes a spinner while loading', () => {
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        go
      </Button>
    )
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('aria-busy', 'true')
    expect(btn.querySelector('.wfp-btn-spinner')).not.toBeNull()
    btn.click()
    expect(onClick).not.toHaveBeenCalled()
  })

  it('stretches full width via modifier class', () => {
    render(<Button fullWidth>w</Button>)
    expect(screen.getByRole('button')).toHaveClass('wfp-btn--block')
  })

  it('forwards a ref to the underlying button element', () => {
    let node: HTMLButtonElement | null = null
    render(
      <Button
        ref={(el) => {
          node = el
        }}
      >
        r
      </Button>
    )
    expect(node).toBeInstanceOf(HTMLButtonElement)
  })
})
