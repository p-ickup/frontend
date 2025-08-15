'use client'
import React from 'react'
import { Stepper, Step, Button, Typography } from '@material-tailwind/react'

export default function About() {
  const [activeStep, setActiveStep] = React.useState(0)
  const [isLastStep, setIsLastStep] = React.useState(false)
  const [isFirstStep, setIsFirstStep] = React.useState(false)

  const handleNext = () => !isLastStep && setActiveStep((cur) => cur + 1)
  const handlePrev = () => !isFirstStep && setActiveStep((cur) => cur - 1)

  return (
    <div className="min-h-[calc(100vh-165px)] bg-gray-100 p-16 text-black">
      <h1 className="mb-8 text-4xl">About PICKUP</h1>
      <p className="mb-6">
        No student should have to spend $100 or more on a solo ride to LAX,
        especially after already buying a costly plane ticket home. While the
        Claremont Colleges sometimes provide subsidized shuttles, these services
        are often limited in timing and availability. That’s where PICKUP comes
        in!
      </p>
      <p className="mb-6">
        We’re a student-led team dedicated to making travel more affordable and
        accessible for the 5C community. Our platform connects you with students
        with similar travel plans so you all can share rides and split costs!
        Using a simple matching form, you can enter your flight details, airport
        preferences, and scheduling needs. From there, our system helps you find
        others headed in the same direction.
      </p>
      <p className="mb-6">
        The idea for PICKUP was born out of personal frustration. After
        struggling to find affordable airport transportation ourselves, we
        realized there was a better solution waiting to be built. With the help
        of our loving and dedicated engineering team, we’ve been working on this
        platform throughout the year.
      </p>
      <p>
        Whether it’s your first ride or your fiftieth, we hope PICKUP makes your
        journey a little easier.
      </p>
      <h1 className="mt-8 text-4xl">How it Works</h1>
      <h2 className="mt-8">Countdown to Flight:</h2>
      <Stepper
        activeStep={activeStep}
        isLastStep={(value) => setIsLastStep(value)}
        isFirstStep={(value) => setIsFirstStep(value)}
        className="mr-10 p-20"
        lineClassName="bg-teal-500/50"
        activeLineClassName="bg-teal-500"
      >
        <Step
          onClick={() => setActiveStep(0)}
          activeClassName="!bg-teal-500"
          completedClassName="!bg-teal-300"
          className="!bg-teal-300 text-white"
        >
          1
          <div className="absolute -bottom-[4.5rem] w-max text-center">
            <Typography
              variant="h6"
              color={activeStep === 0 ? 'blue-gray' : 'gray'}
            >
              Months in Advance
            </Typography>
            <Typography
              color={activeStep === 0 ? 'blue-gray' : 'gray'}
              className="font-normal"
            >
              Book your flight.
            </Typography>
          </div>
        </Step>
        <Step
          onClick={() => setActiveStep(1)}
          activeClassName="!bg-teal-500"
          completedClassName="!bg-teal-300"
          className="!bg-teal-300 text-white"
        >
          2
          <div className="absolute -bottom-[4.5rem] w-max text-center">
            <Typography
              variant="h6"
              color={activeStep === 1 ? 'blue-gray' : 'gray'}
            >
              7 Days
            </Typography>
            <Typography
              color={activeStep === 1 ? 'blue-gray' : 'gray'}
              className="font-normal"
            >
              Complete PICKUP questionnaire.
            </Typography>
            <Typography color="gray" className="mt-1 text-xs italic">
              * anytime between booking and 3 days before *
            </Typography>
          </div>
        </Step>
        <Step
          onClick={() => setActiveStep(2)}
          activeClassName="!bg-teal-500"
          completedClassName="!bg-teal-300"
          className="!bg-teal-300 text-white"
        >
          3
          <div className="absolute -bottom-[4.5rem] w-max text-center">
            <Typography
              variant="h6"
              color={activeStep === 2 ? 'blue-gray' : 'gray'}
            >
              3 Days
            </Typography>
            <Typography
              color={activeStep === 2 ? 'blue-gray' : 'gray'}
              className="font-normal"
            >
              Recieve your match and contact.
            </Typography>
          </div>
        </Step>
        <Step
          onClick={() => setActiveStep(3)}
          activeClassName="!bg-teal-500"
          completedClassName="!bg-teal-300"
          className="!bg-teal-300 text-white"
        >
          4
          <div className="absolute -bottom-[4.5rem] w-max text-center">
            <Typography
              variant="h6"
              color={activeStep === 2 ? 'blue-gray' : 'gray'}
            >
              0 Days!
            </Typography>
            <Typography
              color={activeStep === 2 ? 'blue-gray' : 'gray'}
              className="font-normal"
            >
              Get PICKed UP! Fill out feedback.
            </Typography>
          </div>
        </Step>
      </Stepper>
    </div>
  )
}
