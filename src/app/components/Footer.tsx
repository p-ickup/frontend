export default function Footer() {
    return (
      <footer className="w-full border-t border-t-foreground/60 p-8 bg-teal-400 text-white mt-8">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center">
          <p className="mb-4 md:mb-0 text-lg">
            Designed by P-ickup in California
          </p>
          <div className="flex space-x-4">
            <a href="/about" className="hover:text-gray-400">
              <u>About</u>
            </a>
            <a href="/contact" className="hover:text-gray-400">
              <u>Contact</u>
            </a>
          </div>
        </div>
      </footer>
    );
  }