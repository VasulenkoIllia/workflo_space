import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { Modal } from './Modal.js'
import { Button } from './Button.js'

const meta = {
  title: 'Components/Modal',
  component: Modal,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: { open: false, onClose: () => {} },
} satisfies Meta<typeof Modal>

export default meta
type Story = StoryObj<typeof meta>

/** Click to open. Closes on Esc, backdrop click, or the close button. */
export const Default: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    return (
      <div style={{ padding: 28 }}>
        <Button variant="primary" onClick={() => setOpen(true)}>
          Відкрити модалку
        </Button>
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="Видалити замовлення?"
          aux="ORD-2412"
          footer={
            <>
              <span className="wfp-modal-foot-left">// дію не можна скасувати</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Скасувати
                </Button>
                <Button variant="danger" onClick={() => setOpen(false)}>
                  Видалити
                </Button>
              </div>
            </>
          }
        >
          <p style={{ fontSize: 13, color: 'var(--wf-fg-secondary)', margin: 0 }}>
            Замовлення та всі повʼязані файли буде видалено без можливості відновлення.
          </p>
        </Modal>
      </div>
    )
  },
}
