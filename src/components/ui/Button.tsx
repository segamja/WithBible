import type { ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/utils/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-navy text-white hover:bg-navy-deep shadow-sm',
        secondary: 'bg-sky/30 text-sky-dark hover:bg-sky/45',
        ghost: 'bg-transparent text-ink hover:bg-brand-50',
        outline: 'border border-line bg-panel text-ink hover:bg-brand-50',
        danger: 'bg-coral text-white hover:opacity-90',
        sage: 'bg-sage text-white hover:bg-sage-dark',
        soft: 'bg-brand-50 text-muted hover:bg-brand-100',
      },
      size: {
        sm: 'h-9 px-3.5 text-sm',
        md: 'h-11 px-5 text-sm',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
}
