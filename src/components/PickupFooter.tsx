import SimpleRedirectButton from "./buttons/SimpleRedirectButton";

export default function PickupFooter() {
    return (
      <footer className="w-full border-t border-3 border-t-foreground/60 p-8 bg-gradient-to-r from-teal-500 to-yellow-100 text-white">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center">
          <div className="flex space-x-4">
            <SimpleRedirectButton label="About" route="/about" />
            <SimpleRedirectButton label="Contact" route="/contact" />
            <SimpleRedirectButton label="FAQ" route="/faq" />
          </div>
        </div>
      </footer>
    );
  }