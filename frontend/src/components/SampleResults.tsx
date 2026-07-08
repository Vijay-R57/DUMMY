import sampleBefore from "@/assets/sample-before.jpg";
import sampleAfter from "@/assets/sample-after.jpg";

const sampleScores = {
  before: { sort: 25, setInOrder: 18, shine: 20, standardize: 15, sustain: 12 },
  after: { sort: 85, setInOrder: 90, shine: 88, standardize: 78, sustain: 72 }
};

const categories = [
{ key: "sort" as const, label: "Sort", jp: "Seiri" },
{ key: "setInOrder" as const, label: "Set in Order", jp: "Seiton" },
{ key: "shine" as const, label: "Shine", jp: "Seiso" },
{ key: "standardize" as const, label: "Standardize", jp: "Seiketsu" },
{ key: "sustain" as const, label: "Sustain", jp: "Shitsuke" }];


const ScoreBar = ({ label, jp, before, after }: {label: string;jp: string;before: number;after: number;}) =>
<div className="space-y-2">
    <div className="flex justify-between items-center">
      
      <span className="text-sm font-semibold text-primary">{after - before > 0 ? `+${after - before}%` : after - before < 0 ? `${after - before}%` : `±0%`}</span>
    </div>
    <div className="flex gap-2 items-center">
      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-destructive/60 rounded-full transition-all duration-700" style={{ width: `${before}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-8">{before}%</span>
    </div>
    <div className="flex gap-2 items-center">
      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${after}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-8">{after}%</span>
    </div>
  </div>;


const SampleResults = () => {
  const avgBefore = Math.round(Object.values(sampleScores.before).reduce((a, b) => a + b, 0) / 5);
  const avgAfter = Math.round(Object.values(sampleScores.after).reduce((a, b) => a + b, 0) / 5);

  return (
    <section className="section-padding bg-secondary">
      <div className="container-max">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-heading font-bold text-foreground mb-4">
            Sample 5S Analysis Results
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            See how our AI evaluates workplace organization. Below is an example analysis comparing a workspace before and after 5S implementation.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          {/* Before/After images */}
          <div className="space-y-6">
            <div className="rounded-xl overflow-hidden border border-border shadow-sm">
              <div className="bg-destructive/10 px-4 py-2 border-b border-border">
                <span className="text-sm font-semibold text-destructive">Before Image</span>
              </div>
              <img alt="Workspace before 5S organization" className="w-full h-48 sm:h-64 object-cover" src="/lovable-uploads/8dfb8737-f100-4eca-b70e-d86a2d9aaaa8.jpg" />
            </div>
            <div className="rounded-xl overflow-hidden border border-border shadow-sm">
              <div className="bg-primary/10 px-4 py-2 border-b border-border">
                <span className="text-sm font-semibold text-primary">After Image</span>
              </div>
              <img alt="Workspace after 5S organization" className="w-full h-48 sm:h-64 object-cover" src="/lovable-uploads/ed1f29a2-5ca0-4ccd-a9e2-1577c80d61b6.png" />
            </div>
          </div>

          {/* Scores */}
          <div className="bg-card rounded-xl border border-border p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-heading font-semibold text-card-foreground">5S Scores</h3>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-destructive/60" /> Before</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-primary" /> After</span>
              </div>
            </div>

            <div className="space-y-5">
              {categories.map((cat) =>
              <ScoreBar
                key={cat.key}
                label={cat.label}
                jp={cat.jp}
                before={sampleScores.before[cat.key]}
                after={sampleScores.after[cat.key]} />

              )}
            </div>

            <div className="mt-6 pt-6 border-t border-border flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Overall Score</span>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-destructive/70">{avgBefore}%</span>
                <span className="text-muted-foreground">→</span>
                <span className="text-lg font-bold text-primary">{avgAfter}%</span>
              </div>
            </div>

            <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/10">
              <h4 className="text-sm font-semibold text-foreground mb-2">Sample Recommendations</h4>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li>• Implement shadow boards for all hand tools</li>
                <li>• Add floor markings for walkways and storage zones</li>
                <li>• Create standardized daily cleaning checklist</li>
                <li>• Install visual management boards at workstations</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>);

};

export default SampleResults;