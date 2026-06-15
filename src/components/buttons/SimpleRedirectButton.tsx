'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

interface SimpleRedirectButtonProps {
  label: string
  route: string
  variant?: 'plain' | 'nav' | 'mobile' | 'cta'
  onNavigate?: () => void
  className?: string
}

function isRouteActive(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`)
}

function isExactRoute(pathname: string, route: string) {
  return pathname === route
}

const SimpleRedirectButton: React.FC<SimpleRedirectButtonProps> = ({
  label,
  route,
  variant = 'plain',
  onNavigate,
  className = '',
}) => {
  const pathname = usePathname()
  const [isNavigating, setIsNavigating] = useState(false)
  const isActive = isRouteActive(pathname, route)
  const isCurrentPage = isExactRoute(pathname, route)

  useEffect(() => {
    setIsNavigating(false)
  }, [pathname])

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (isCurrentPage) {
      event.preventDefault()
      return
    }

    setIsNavigating(true)
    onNavigate?.()
  }

  const linkClassName = [
    'items-center gap-2 transition-all duration-150',
    variant === 'mobile' ? 'flex w-full' : 'inline-flex',
    variant === 'nav' &&
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 group-hover:text-yellow-100',
    variant === 'cta' &&
      'rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 px-6 py-3 font-medium text-white shadow-md hover:from-teal-600 hover:to-cyan-600 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 active:scale-95',
    variant === 'plain' &&
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 hover:text-yellow-50 hover:underline',
    variant === 'mobile' &&
      'rounded-lg px-2 py-2 text-left hover:bg-white/10 hover:text-yellow-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 active:bg-white/20',
    isActive && variant === 'nav' && 'text-yellow-50',
    isActive && variant === 'mobile' && 'bg-white/15 text-yellow-50',
    isNavigating && 'pointer-events-none scale-[0.98] opacity-75',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const link = (
    <Link
      href={route}
      onClick={handleClick}
      aria-current={isActive ? 'page' : undefined}
      aria-busy={isNavigating}
      className={linkClassName}
    >
      {isNavigating && (
        <span
          className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white"
          aria-hidden="true"
        />
      )}
      {label}
    </Link>
  )

  if (variant === 'nav') {
    return (
      <div
        className={[
          'group cursor-pointer rounded-lg bg-white/10 px-1 py-1 backdrop-blur-sm transition-all duration-150',
          'hover:bg-white/25 hover:ring-1 hover:ring-white/40',
          'active:scale-95',
          isActive && 'bg-white/20 shadow-inner ring-1 ring-white/30',
          isActive && 'hover:bg-white/30',
          isNavigating && 'bg-white/25 opacity-75',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {link}
      </div>
    )
  }

  return link
}

export default SimpleRedirectButton
