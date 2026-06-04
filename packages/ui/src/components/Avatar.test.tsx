import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Avatar, AvatarStack } from './Avatar.js'

describe('Avatar', () => {
  it('derives initials from a full name', () => {
    render(<Avatar name="Олена Іваненко" />)
    expect(screen.getByText('ОІ')).toBeInTheDocument()
  })

  it('uses an explicit initials override', () => {
    render(<Avatar initials="+3" />)
    expect(screen.getByText('+3')).toBeInTheDocument()
  })

  it('renders an image when src is provided', () => {
    render(<Avatar name="Олена" src="/a.png" />)
    expect(screen.getByRole('img')).toHaveAttribute('src', '/a.png')
  })

  it('groups avatars in a stack', () => {
    const { container } = render(
      <AvatarStack>
        <Avatar name="A B" />
        <Avatar name="C D" />
      </AvatarStack>
    )
    expect(container.querySelector('.wfp-av-stack')?.querySelectorAll('.wfp-av').length).toBe(2)
  })
})
