import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Input } from './Input.js'

describe('Input', () => {
  it('associates the label with the input', () => {
    render(<Input label="Email" />)
    expect(screen.getByLabelText('Email')).toBeInstanceOf(HTMLInputElement)
  })

  it('shows hint text', () => {
    render(<Input label="Email" hint="буде логіном" />)
    expect(screen.getByText('буде логіном')).toBeInTheDocument()
  })

  it('wires the error state: aria-invalid + error class + message', () => {
    const { container } = render(<Input label="Email" error="невірний email" />)
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    expect(container.querySelector('.wfp-field--error')).not.toBeNull()
    expect(screen.getByText('невірний email')).toBeInTheDocument()
  })

  it('forwards onChange', () => {
    const onChange = vi.fn()
    render(<Input label="Email" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.co' } })
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
