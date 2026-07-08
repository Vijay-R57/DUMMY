import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";

const Footer = () => {
  return (
    <footer className="bg-foreground text-primary-foreground">
      <div className="container-max px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img src={logo} alt="ArcoLabs" className="h-8 w-auto brightness-200" />
              <span className="text-lg font-heading font-bold mx-0 px-0 my-0">Arcolab</span>
            </div>
            <p className="text-sm text-primary-foreground/70 max-w-xs leading-relaxed">
              AI-powered 5S workplace organization analysis. Transform your workspace with data-driven insights.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li><Link to="/" className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors">Home</Link></li>
              <li><Link to="/analysis" className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors">5S Analysis</Link></li>
              <li><Link to="/about" className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors">About</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider mb-4">5S Methodology</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/70">
              <li>Sort</li>
              <li>Set in Order</li>
              <li>Shine</li>
              <li>Standardize</li>
              <li>Sustain</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-primary-foreground/10 mt-10 pt-8 text-center">
          <p className="text-xs text-primary-foreground/50">© 2026 Arcolab. All rights reserved.

          </p>
        </div>
      </div>
    </footer>);

};

export default Footer;