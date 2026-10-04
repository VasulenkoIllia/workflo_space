import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Tabs, type TabItem } from './Tabs.js'

const items: TabItem[] = [
  { id: 'a', label: 'A', badge: 3 },
  { id: 'b', label: 'B' },
]

describe('Tabs', () => {
  it('renders tabs + badge and marks the active one', () => {
    render(<Tabs items={items} value="a" onChange={() => {}} />)
    const a = screen.getByRole('tab', { name: /A/ })
    expect(a).toHaveAttribute('aria-selected', 'true')
    expect(a).toHaveAttribute('data-on', 'true')
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'B' })).toHaveAttribute('aria-selected', 'false')
  })

  it('calls onChange on click', () => {
    const onChange = vi.fn()
    render(<Tabs items={items} value="a" onChange={onChange} />)
    fireEvent.click(screen.getByRole('tab', { name: 'B' }))
    expect(onChange).toHaveBeenCalledWith('b')
  })
})
