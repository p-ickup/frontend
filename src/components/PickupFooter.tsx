import SimpleRedirectButton from './buttons/SimpleRedirectButton'

export default function PickupFooter() {
  return (
    <footer className="w-full border-t-foreground/60 bg-gradient-to-r from-teal-500 to-yellow-100 p-8 text-white">
      <div className="container mx-auto flex flex-col items-center justify-between md:flex-row">
        <div className="flex space-x-4">
          <SimpleRedirectButton label="About" route="/about" />
          <SimpleRedirectButton label="Contact" route="/contact" />
          <SimpleRedirectButton label="FAQ" route="/faq" />
        </div>
      </div>
    </footer>
  )
}
