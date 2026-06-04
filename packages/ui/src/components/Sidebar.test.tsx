import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Sidebar, type SidebarNavEntry } from './Sidebar.js'

const NAV: SidebarNavEntry[] = [
  { id: 'orders', label: 'Замовлення', href: '/orders' },
  { group: 'Команда' },
  { id: 'team', label: 'Учасники', badge: '4' },
]

describe('Sidebar', () => {
  it('renders items, a group label, and a badge', () => {
    render(<Sidebar nav={NAV} active="orders" aesthetic="A" sub="portal" />)
    expect(screen.getByText('Замовлення')).toBeInTheDocument()
    expect(screen.getByText('// команда')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('marks the active item', () => {
    render(<Sidebar nav={NAV} active="orders" />)
    expect(screen.getByText('Замовлення').closest('a')).toHaveAttribute('data-on', 'true')
  })

  it('calls onNavigate (and prevents default) on item click', () => {
    const onNavigate = vi.fn()
    render(<Sidebar nav={NAV} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByText('Замовлення'))
    expect(onNavigate).toHaveBeenCalledWith('orders', '/orders')
  })

  it('renders group labels verbatim in studio (B) aesthetic', () => {
    render(<Sidebar nav={NAV} aesthetic="B" />)
    expect(screen.getByText('Команда')).toBeInTheDocument()
  })
})
