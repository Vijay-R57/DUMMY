import { useState, useEffect } from "react";
import { X } from "lucide-react";

const CookieConsent = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem("arcolab_cookie_consent");
    if (!accepted) {
      // Small delay so it doesn't flash immediately
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  const accept = () => {
    localStorage.setItem("arcolab_cookie_consent", "accepted");
    setVisible(false);
  };

  const dismiss = () => {
    localStorage.setItem("arcolab_cookie_consent", "dismissed");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-[hsl(var(--card))] border border-border rounded-2xl shadow-2xl p-6 sm:p-8">
        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-5 w-5" />
        </button>

        <p className="text-sm sm:text-base text-foreground text-center leading-relaxed pr-6">
          We use cookies to ensure you get the best possible experience on our website. By continuing
          to use this website, you consent to us using cookies as is outlined in our{" "}
          <span className="text-primary underline underline-offset-2 cursor-pointer">Cookie Policy</span>.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
          <button
            onClick={dismiss}
            className="w-full sm:w-auto px-7 py-2.5 rounded-full border-2 border-primary text-primary bg-transparent font-semibold text-sm hover:bg-primary/5 transition-colors"
          >
            Learn More
          </button>
          <button
            onClick={accept}
            className="w-full sm:w-auto px-7 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
          >
            Accept All Cookies
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
