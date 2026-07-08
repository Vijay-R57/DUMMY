import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import logo from "@/assets/logo.png";
import corporateOffice from "@/assets/corporate-office.jpg";
import { Target, Layers, Sparkles, Shield, RefreshCcw } from "lucide-react";

const fiveSPillars = [
  {
    icon: Target,
    title: "Sort (Seiri)",
    description: "Remove unnecessary items from the workplace. Separate needed tools, parts, and materials from unneeded ones. Discard or relocate items that are not required for current operations.",
    color: "bg-destructive/10 text-destructive",
  },
  {
    icon: Layers,
    title: "Set in Order (Seiton)",
    description: "Organize remaining items so they are easy to find and use. Arrange tools and materials in a logical order, label storage locations, and use visual indicators like shadow boards.",
    color: "bg-warning/10 text-warning",
  },
  {
    icon: Sparkles,
    title: "Shine (Seiso)",
    description: "Clean the workspace thoroughly and maintain cleanliness as a daily routine. Regular cleaning helps identify abnormalities such as leaks, vibrations, and breakages early.",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: Shield,
    title: "Standardize (Seiketsu)",
    description: "Establish standards and procedures to maintain the first three S's. Create visual controls, checklists, and schedules that make the organized state the normal way of operating.",
    color: "bg-blue-100 text-blue-700",
  },
  {
    icon: RefreshCcw,
    title: "Sustain (Shitsuke)",
    description: "Build a culture of discipline to maintain standards over time. Conduct regular audits, provide training, and foster a mindset of continuous improvement throughout the organization.",
    color: "bg-violet-100 text-violet-700",
  },
];

const About = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0">
            <img src={corporateOffice} alt="ArcoLabs office" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-foreground/80" />
          </div>
          <div className="relative container-max px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
            <div className="max-w-3xl">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-extrabold text-primary-foreground mb-6">
                About ArcoLabs
              </h1>
              <p className="text-lg text-primary-foreground/80 leading-relaxed">
                ArcoLabs leverages artificial intelligence to bring modern solutions to workplace organization challenges. Our 5S analysis tool empowers teams to assess, improve, and maintain world-class operational environments.
              </p>
            </div>
          </div>
        </section>

        {/* Mission */}
        <section className="section-padding bg-background">
          <div className="container-max">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-2xl sm:text-3xl font-heading font-bold text-foreground mb-6">Our Mission</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  At ArcoLabs, we believe that an organized workplace is the foundation of operational excellence. Our mission is to make 5S methodology accessible, measurable, and actionable through the power of AI.
                </p>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  By providing instant, objective assessments of workspace organization, we help businesses reduce waste, improve safety, boost productivity, and create environments where teams can do their best work.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Whether you're implementing 5S for the first time or sustaining an existing program, ArcoLabs gives you the data-driven insights to drive continuous improvement.
                </p>
              </div>
              <div className="flex justify-center">
                <img src={logo} alt="ArcoLabs Logo" className="w-48 sm:w-64 h-auto opacity-90" />
              </div>
            </div>
          </div>
        </section>

        {/* 5S Methodology */}
        <section className="section-padding bg-secondary">
          <div className="container-max">
            <div className="text-center mb-12 sm:mb-16">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-heading font-bold text-foreground mb-4">
                The 5S Methodology
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Originating from the Toyota Production System in Japan, 5S is a systematic approach to workplace organization that improves efficiency, safety, and morale.
              </p>
            </div>

            <div className="space-y-6">
              {fiveSPillars.map((pillar, i) => (
                <div key={pillar.title} className="bg-card rounded-xl border border-border p-6 sm:p-8 flex flex-col sm:flex-row gap-5">
                  <div className={`w-12 h-12 rounded-lg ${pillar.color} flex items-center justify-center flex-shrink-0`}>
                    <pillar.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-heading font-semibold text-card-foreground mb-2">{pillar.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{pillar.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="section-padding bg-background">
          <div className="container-max">
            <h2 className="text-2xl sm:text-3xl font-heading font-bold text-foreground mb-8 text-center">
              Benefits of 5S Implementation
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { title: "Reduced Waste", desc: "Eliminate unnecessary materials, motion, and time" },
                { title: "Improved Safety", desc: "Cleaner, organized workspaces reduce accident risks" },
                { title: "Higher Productivity", desc: "Spend less time searching, more time producing" },
                { title: "Better Morale", desc: "Organized environments boost team satisfaction" },
              ].map((b) => (
                <div key={b.title} className="text-center p-6 rounded-xl border border-border bg-card">
                  <h4 className="text-base font-heading font-semibold text-card-foreground mb-2">{b.title}</h4>
                  <p className="text-sm text-muted-foreground">{b.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default About;
