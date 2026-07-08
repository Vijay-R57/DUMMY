import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import HeroSection from "@/components/HeroSection";
import FeaturesSection from "@/components/FeaturesSection";
import SampleResults from "@/components/SampleResults";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import corporateOffice from "@/assets/corporate-office.jpg";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <FeaturesSection />
        <SampleResults />

        {/* Corporate CTA section */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0">
            <img src={corporateOffice} alt="Corporate environment" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-foreground/80" />
          </div>
          <div className="relative container-max px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-heading font-bold text-primary-foreground mb-4">
              Ready to Transform Your Workspace?
            </h2>
            <p className="text-primary-foreground/70 max-w-xl mx-auto mb-8">
              Start your 5S analysis today and get actionable insights to improve workplace efficiency, safety, and organization.
            </p>
            <Link
              to="/select-office"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
            >
              Run Your Analysis Now
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Index;
