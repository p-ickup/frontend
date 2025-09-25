import SimpleRedirectButton from './buttons/SimpleRedirectButton'

export default function PickupFooter() {
  return (
    <footer className="w-full border-t-foreground/60 bg-gradient-to-r from-teal-500 to-yellow-100 p-4 text-white sm:p-6 lg:p-8">
      <div className="container mx-auto flex flex-col items-center justify-between md:flex-row">
        <div className="flex flex-wrap justify-center gap-2 sm:gap-4">
          <SimpleRedirectButton label="About" route="/about" />
          <SimpleRedirectButton label="Contact" route="/contact" />
          <SimpleRedirectButton label="FAQ" route="/faq" />
          <SimpleRedirectButton label="ASPC Info" route="/aspc-info" />
        </div>
      </div>
    </footer>
  )
}
