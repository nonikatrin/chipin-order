import { Ic } from './icons'

interface StepperProps {
  currentStep: number
  labels?: string[]
}

export function Stepper({ currentStep, labels }: StepperProps) {
  const steps = labels ?? ['Info', 'Schedule', 'Menu', 'Summary']

  return (
    <div className="stepper" aria-label="Purchase order progress">
      {steps.map((label, index) => {
        const stepNumber = index + 1
        const isComplete = currentStep > stepNumber
        const isActive = currentStep === stepNumber
        const lineDone = currentStep >= stepNumber

        return (
          <div className="stepper__item" key={label}>
            {index > 0 && (
              <div className={`stepper__line ${lineDone ? 'stepper__line--done' : 'stepper__line--pending'}`} />
            )}
            <div className="stepper__content">
              <div className={`stepper__dot ${isActive ? 'stepper__dot--active' : isComplete ? 'stepper__dot--complete' : ''}`}>
                {isComplete ? Ic.check : stepNumber}
              </div>
              <div className={`stepper__label ${isActive ? 'stepper__label--active' : isComplete ? 'stepper__label--complete' : ''}`}>
                {label}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
