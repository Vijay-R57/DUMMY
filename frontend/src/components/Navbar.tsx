import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, LogOut, User, History } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/logo-new.png";

const navLinks = [
  { to: "/", label: "Home" },
  { to: "/analysis", label: "5S Analysis" },
  { to: "/audit", label: "Audit" },
  { to: "/lean-maintenance", label: "Lean Maintenance" },
  { to: "/history", label: "History" },
  { to: "/about", label: "About" },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { employee, isAuthenticated, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-border">
      <div className="container-max px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          <Link to="/" className="flex items-center">
            <img src={logo} alt="Arcolab" className="h-20 sm:h-28 w-auto" />
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  location.pathname === link.to ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <Link
                  to="/profile"
                  className="flex items-center gap-2 text-xs text-muted-foreground border border-border rounded-md px-3 py-1.5 hover:bg-accent transition-colors"
                >
                  <User className="h-3.5 w-3.5" />
                  <span className="font-medium text-foreground">{employee?.name}</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            ) : (
              <Link
                to="/select-office"
                className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
              >
                Employee Login
              </Link>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-foreground"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="md:hidden pb-4 border-t border-border pt-4 space-y-3">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 text-base font-medium rounded-md transition-colors ${
                  location.pathname === link.to
                    ? "text-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {link.to === "/history" && <History className="h-4 w-4" />}
                {link.label}
              </Link>
            ))}
            {isAuthenticated ? (
              <>
                <Link
                  to="/profile"
                  onClick={() => setMobileOpen(false)}
                  className="mx-3 flex items-center gap-2 text-xs text-muted-foreground border border-border rounded-md px-3 py-2 hover:bg-accent transition-colors"
                >
                  <User className="h-3.5 w-3.5" />
                  <div>
                    <span className="font-medium text-foreground block">{employee?.name}</span>
                    <span className="text-xs">{employee?.department}</span>
                  </div>
                </Link>
                <button
                  onClick={() => { setMobileOpen(false); handleLogout(); }}
                  className="block mx-3 w-[calc(100%-1.5rem)] text-center rounded-md border border-input bg-background px-5 py-2.5 text-sm font-medium text-foreground"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/select-office"
                onClick={() => setMobileOpen(false)}
                className="block mx-3 text-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Employee Login
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
