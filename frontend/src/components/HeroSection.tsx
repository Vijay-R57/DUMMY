import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, Shield, Zap } from "lucide-react";
import heroImage from "@/assets/hero-workspace.jpg";

const HeroSection = () => {
  return (
    <section className="relative overflow-hidden">
      {/* Hero image background */}
      <div className="absolute inset-0">
        <img src={heroImage} alt="Modern organized workspace" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-foreground/75" />
      </div>

      <div className="relative container-max px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-36">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/20 border border-primary/30 px-4 py-1.5 mb-6">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-medium text-primary-foreground/90">AI-Powered Analysis</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-heading font-extrabold text-primary-foreground leading-tight mb-6">
            5S Workplace Analysis
            <span className="block text-primary mt-1">by ArcoLab</span>
          </h1>

          <p className="text-base sm:text-lg text-primary-foreground/80 max-w-2xl mb-8 leading-relaxed">
            Upload before and after images of your workspace. Our AI analyzes adherence to the 5S methodology — Sort, Set in Order, Shine, Standardize, and Sustain — delivering actionable recommendations and detailed reports.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-12">
            <Link
              to="/select-office"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors">

              Start Your Analysis
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/about"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-primary-foreground/30 px-6 py-3 text-base font-semibold text-primary-foreground hover:bg-primary-foreground/10 transition-colors">

              Learn About 5S
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
            { icon: BarChart3, label: "5S Scoring", desc: "Detailed category scores" },
            { icon: Shield, label: "AI Analysis", desc: "Powered by advanced AI" },
            { icon: Zap, label: "Instant Reports", desc: "Download PDF reports" }].
            map((item) =>
            <div key={item.label} className="flex items-center gap-3 bg-primary-foreground/5 backdrop-blur rounded-lg p-3 border border-primary-foreground/10">
                <item.icon className="h-5 w-5 text-primary flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-primary-foreground">{item.label}</p>
                  <p className="text-xs text-primary-foreground/60">{item.desc}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>);

};

export default HeroSection;