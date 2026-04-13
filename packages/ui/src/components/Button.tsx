import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'
import { cn } from '../lib/cn.js'

type ButtonProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>

export function Button({ children, className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-md bg-black px-4 text-sm font-medium text-white',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
