'use client'
import React from 'react'
import {
  Accordion,
  AccordionHeader,
  AccordionBody,
} from '@material-tailwind/react'
import SimpleRedirectButton from '@/components/buttons/SimpleRedirectButton'

export default function Faq() {
  const [open, setOpen] = React.useState(1)

  const handleOpen = (value: React.SetStateAction<number>) =>
    setOpen(open === value ? 0 : value)

  return (
    <div className="min-h-[calc(100vh-165px)] bg-gradient-to-r from-teal-200 to-yellow-100 p-20 text-black">
      <h1 className="mb-16 flex justify-center text-5xl font-semibold">
        Frequently Asked Questions
      </h1>
      <p className="m-8 flex">
        Small blurb about P-ickup Lorem ipsum, dolor sit amet consectetur
        adipisicing elit. Expedita nobis distinctio maxime saepe quas dolor
        assumenda velit ab qui ipsum nulla nemo, architecto dolore dignissimos
        ducimus est eaque culpa? Rem.
      </p>
      <Accordion
        open={open === 1}
        className="mb-8 rounded-lg bg-gray-100 p-5 shadow-md"
      >
        <AccordionHeader onClick={() => handleOpen(1)}>
          Can I edit my questionnaire?
        </AccordionHeader>
        <AccordionBody>
          You can edit your information{' '}
          <strong>UP TO 3 DAYS BEFORE YOUR FLIGHT.</strong> Otherwise, you must
          cancel it and send in a new questionnaire. In that case, on your
          questionnaire, you can opt in to be placed in the unmatched section
          where you can try to find others who you may be able to split a ride
          with.
        </AccordionBody>
      </Accordion>
      <Accordion
        open={open === 2}
        className="mb-8 rounded-lg bg-gray-100 p-5 shadow-md"
      >
        <AccordionHeader onClick={() => handleOpen(2)}>
          When will I know who I am matched with?
        </AccordionHeader>
        <AccordionBody>
          We will display your match 3 DAYS BEFORE YOUR FLIGHT, unless you do
          not submit your questionnaire more than 3 days in advance. In that
          case, on your questionnaire, you can opt in to be placed in the
          unmatched section where you can try to find others who you may be able
          to split a ride with.
        </AccordionBody>
      </Accordion>
      <Accordion
        open={open === 3}
        className="mb-8 rounded-lg bg-gray-100 p-5 shadow-md"
      >
        <AccordionHeader onClick={() => handleOpen(3)}>
          What happens if I’m not matched?
        </AccordionHeader>
        <AccordionBody>
          When you fill out your questionnaire form, you have the option to opt
          in to be placed in the unmatched section if we can’t find you a match.
          This page will help you find others who you may be able to split a
          ride with.
        </AccordionBody>
      </Accordion>
      <Accordion
        open={open === 4}
        className="mb-8 rounded-lg bg-gray-100 p-5 shadow-md"
      >
        <AccordionHeader onClick={() => handleOpen(4)}>
          What happens if I or someone in my group has a delayed/canceled
          flight?
        </AccordionHeader>
        <AccordionBody>
          Please utilize the commenting system on your match so that you can
          update your group members about any issues. We hope your group can
          come to an agreement if this happens, for example, how long of a delay
          is too long for group members to wait for you. The delayed member can
          always opt in to the unmatched section to find others.
        </AccordionBody>
      </Accordion>
      <Accordion
        open={open === 5}
        className="mb-8 rounded-lg bg-gray-100 p-5 shadow-md"
      >
        <AccordionHeader onClick={() => handleOpen(5)}>
          What if I need to cancel my questionnaire/match due to unforeseen
          circumstances?
        </AccordionHeader>
        <AccordionBody>
          We understand travelling can be unpredictable. If at all possible,
          please cancel your questionnaire form for your flight at least 3 days
          in advance of your flight. This way, you will not be affecting any
          group creations. <br></br>
          If that is not possible, then you can cancel, but keep in mind that
          this will affect the others assigned to your group.
        </AccordionBody>
      </Accordion>
      <Accordion
        open={open === 6}
        className="mb-8 rounded-lg bg-gray-100 p-5 shadow-md"
      >
        <AccordionHeader onClick={() => handleOpen(6)}>
          Can I get a rematch?
        </AccordionHeader>
        <AccordionBody>
          You cannot request a rematch at this time. If you are dissatisfied
          with your match, you can cancel. If you resend in a questionnaire and
          opt in to being in the unmatched section, you can find others who you
          may be able to split a ride with.
        </AccordionBody>
      </Accordion>
      <Accordion
        open={open === 7}
        className="mb-8 rounded-lg bg-gray-100 p-5 shadow-md"
      >
        <AccordionHeader onClick={() => handleOpen(7)}>
          How exactly am I being matched?
        </AccordionHeader>
        <AccordionBody>
          We are using a machine learning model to group all of our existing
          match requests by flight time, bag numbers, terminals, drop off
          points, and other important details. Our model’s performance improves
          as our user base increases, so please spread the word about Pickup!
          Further, please submit feedback on matches so that we can improve our
          model in the future!
        </AccordionBody>
      </Accordion>
      <Accordion
        open={open === 8}
        className="mb-8 rounded-lg bg-gray-100 p-5 shadow-md"
      >
        <AccordionHeader onClick={() => handleOpen(8)}>
          What information is shared with other users?
        </AccordionHeader>
        <AccordionBody>
          We aim to keep our users as anonymous as possible. Once you’ve matched
          with a group, we provide the group members your first name and email.
          We do not share your flight info, last name, or phone number. Further,
          we do not share any personal info with people not in your group.
        </AccordionBody>
      </Accordion>
      <Accordion
        open={open === 9}
        className="mb-12 rounded-lg bg-gray-100 p-5 shadow-md"
      >
        <AccordionHeader onClick={() => handleOpen(9)}>
          What if I didn’t get the price that I was hoping for?
        </AccordionHeader>
        <AccordionBody>
          We will try our best to get a match that has a price within your
          budget but we cannot guarantee this. We assure you that our machine
          learning model will try to find the optimal match for you! Our model’s
          performance improves as our user base increases, so please spread the
          word about Pickup! Also, submit feedback so we can train our model to
          be better!
        </AccordionBody>
      </Accordion>
      <h2 className="text-lg font-semibold">
        If you have any other questions, do not hesitate to{' '}
        <SimpleRedirectButton label="Contact Us." route="/contact" />
      </h2>
    </div>
  )
}
