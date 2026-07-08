import { Upload, Brain, FileText, TrendingUp, CheckCircle, ClipboardList } from "lucide-react";

const features = [
  {
    icon: Upload,
    title: "Upload Before & After",
    description: "Simply upload images of your workspace before and after organization efforts for comparison.",
  },
  {
    icon: Brain,
    title: "AI-Powered Analysis",
    description: "Our advanced AI evaluates each image against all five pillars of the 5S methodology.",
  },
  {
    icon: ClipboardList,
    title: "5S Scoring",
    description: "Get individual scores for Sort, Set in Order, Shine, Standardize, and Sustain categories.",
  },
  {
    icon: TrendingUp,
    title: "Improvement Tracking",
    description: "Compare before and after scores to quantify the impact of your organization improvements.",
  },
  {
    icon: CheckCircle,
    title: "Actionable Recommendations",
    description: "Receive specific, prioritized recommendations to further improve your workspace organization.",
  },
  {
    icon: FileText,
    title: "PDF Reports",
    description: "Download comprehensive PDF reports to share with your team and track progress over time.",
  },
];

const FeaturesSection = () => {
  return (
    <section className="section-padding bg-background">
      <div className="container-max">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-heading font-bold text-foreground mb-4">
            How It Works
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            A streamlined process to assess and improve workplace organization using the 5S methodology.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className="group p-6 sm:p-8 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-lg transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-heading font-semibold text-card-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
