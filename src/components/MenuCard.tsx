import type { ReactNode } from 'react'

interface MenuCardProps {
  title: ReactNode
  eyebrow?: ReactNode
  subtitle?: ReactNode
  headerLeading?: ReactNode
  headerAction?: ReactNode
  tip?: ReactNode
  footer?: ReactNode
  children: ReactNode
  isEmpty?: boolean
  bodyClassName?: string
  className?: string
}

export function MenuCard({
  title,
  eyebrow,
  subtitle,
  headerLeading,
  headerAction,
  tip,
  footer,
  children,
  isEmpty = false,
  bodyClassName,
  className,
}: MenuCardProps) {
  const bodyClasses = ['menu-card__body']
  if (isEmpty) bodyClasses.push('empty-state')
  if (bodyClassName) bodyClasses.push(bodyClassName)

  return (
    <div className={['menu-card', className].filter(Boolean).join(' ')}>
      <div className="menu-card__header">
        {headerLeading}
        <div className="menu-card__heading">
          {eyebrow ? <div className="menu-step-card__eyebrow">{eyebrow}</div> : null}
          <h2 className="menu-step-card__title">{title}</h2>
          {subtitle ? <p className="menu-step-card__subtitle">{subtitle}</p> : null}
        </div>
        {headerAction}
      </div>

      <div className={bodyClasses.join(' ')}>{children}</div>

      {tip ? <div className="menu-card__tip">{tip}</div> : null}
      {footer ? <div className="menu-card__footer">{footer}</div> : null}
    </div>
  )
}