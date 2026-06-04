import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from './Badge.js'
import { StatusDot } from './StatusDot.js'
import { Card } from './Card.js'
import { EmptyState } from './EmptyState.js'
import { Skeleton } from './Skeleton.js'

describe('Badge', () => {
  it('maps a tone to the design class', () => {
    render(<Badge tone="success">paid</Badge>)
    expect(screen.getByText('paid')).toHaveClass('wfp-badge', 'wfp-badge--paid')
  })
})

describe('StatusDot', () => {
  it('applies the tone colour inline and is decorative', () => {
    const { container } = render(<StatusDot tone="danger" />)
    const dot = container.querySelector('.wfp-status-dot')
    expect(dot).not.toBeNull()
    expect(dot).toHaveAttribute('aria-hidden', 'true')
    expect((dot as HTMLElement).style.background).toContain('--wf-destructive')
  })
})

describe('Card', () => {
  it('renders the header only when title/aux/actions are provided', () => {
    const { container, rerender } = render(<Card>body</Card>)
    expect(container.querySelector('.wfp-card-h')).toBeNull()
    rerender(<Card title="Фінанси">body</Card>)
    expect(container.querySelector('.wfp-card-h-t')?.textContent).toBe('Фінанси')
  })
})

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState title="порожньо" description="нічого немає" />)
    expect(screen.getByText('порожньо')).toBeInTheDocument()
    expect(screen.getByText('нічого немає')).toBeInTheDocument()
  })
})

describe('Skeleton', () => {
  it('applies the variant class', () => {
    const { container } = render(<Skeleton variant="title" />)
    expect(container.querySelector('.wf-skel.wf-skel--title')).not.toBeNull()
  })
})
