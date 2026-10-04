import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Modal } from './Modal.js'

describe('Modal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <Modal open={false} onClose={() => {}} title="X">
        body
      </Modal>
    )
    expect(container.querySelector('.wfp-modal')).toBeNull()
  })

  it('renders an accessible dialog when open', () => {
    render(
      <Modal open onClose={() => {}} title="Підтвердження">
        body
      </Modal>
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('Підтвердження')).toBeInTheDocument()
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="X">
        body
      </Modal>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on backdrop click but not when the dialog is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(
      <Modal open onClose={onClose} title="X">
        body
      </Modal>
    )
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(container.querySelector('.wfp-modal-overlay')!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes via the close button', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="X">
        body
      </Modal>
    )
    fireEvent.click(screen.getByLabelText('Закрити'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
