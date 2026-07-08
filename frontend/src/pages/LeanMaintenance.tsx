import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Wrench, Clock, CheckCircle2, AlertTriangle, Plus, Trash2, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface MaintenanceAction {
  id: string;
  area: string;
  task: string;
  priority: "high" | "medium" | "low";
  status: "pending" | "in-progress" | "completed";
  createdAt: string;
  completedAt?: string;
}

const priorityConfig = {
  high: { label: "High", className: "bg-destructive/10 text-destructive border-destructive/20" },
  medium: { label: "Medium", className: "bg-warning/10 text-warning border-warning/20" },
  low: { label: "Low", className: "bg-primary/10 text-primary border-primary/20" },
};

const statusConfig = {
  pending: { label: "Pending", icon: Clock, className: "text-muted-foreground" },
  "in-progress": { label: "In Progress", icon: AlertTriangle, className: "text-warning" },
  completed: { label: "Completed", icon: CheckCircle2, className: "text-primary" },
};

const leanRecommendations = [
  {
    title: "Implement TPM (Total Productive Maintenance)",
    description: "Establish autonomous maintenance routines where operators perform daily equipment checks, cleaning, and minor adjustments to prevent breakdowns.",
    category: "Preventive",
  },
  {
    title: "Apply SMED for Changeover Reduction",
    description: "Use Single-Minute Exchange of Die techniques to reduce setup and changeover times, minimizing downtime between production runs.",
    category: "Efficiency",
  },
  {
    title: "Establish Visual Management Standards",
    description: "Deploy color-coded labels, shadow boards, and floor markings to maintain 5S standards and make abnormalities immediately visible.",
    category: "Visual",
  },
  {
    title: "Create Standardized Work Instructions",
    description: "Document best practices for each maintenance task with clear step-by-step procedures, safety checks, and quality verification points.",
    category: "Standardization",
  },
  {
    title: "Implement Predictive Maintenance Sensors",
    description: "Use vibration analysis, thermal imaging, and oil analysis to predict equipment failures before they occur, shifting from reactive to proactive maintenance.",
    category: "Predictive",
  },
  {
    title: "Conduct Regular Gemba Walks",
    description: "Schedule structured workplace observation walks to identify waste, safety hazards, and improvement opportunities directly at the point of work.",
    category: "Continuous Improvement",
  },
];

const formatTimestamp = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " at " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
};

const LeanMaintenance = () => {
  const [actions, setActions] = useState<MaintenanceAction[]>([
    {
      id: "1",
      area: "Assembly Line A",
      task: "Organize tool storage with shadow boards",
      priority: "high",
      status: "completed",
      createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      completedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
      id: "2",
      area: "Warehouse Zone B",
      task: "Label all storage bins and implement FIFO system",
      priority: "medium",
      status: "in-progress",
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
    {
      id: "3",
      area: "Quality Control Station",
      task: "Install visual inspection checklist boards",
      priority: "low",
      status: "pending",
      createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    },
  ]);

  const [newArea, setNewArea] = useState("");
  const [newTask, setNewTask] = useState("");
  const [newPriority, setNewPriority] = useState<"high" | "medium" | "low">("medium");

  const addAction = () => {
    if (!newArea.trim() || !newTask.trim()) return;
    const action: MaintenanceAction = {
      id: Date.now().toString(),
      area: newArea.trim(),
      task: newTask.trim(),
      priority: newPriority,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    setActions((prev) => [action, ...prev]);
    setNewArea("");
    setNewTask("");
    setNewPriority("medium");
  };

  const updateStatus = (id: string, status: MaintenanceAction["status"]) => {
    setActions((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status, completedAt: status === "completed" ? new Date().toISOString() : undefined }
          : a
      )
    );
  };

  const removeAction = (id: string) => {
    setActions((prev) => prev.filter((a) => a.id !== id));
  };

  const completed = actions.filter((a) => a.status === "completed").length;
  const inProgress = actions.filter((a) => a.status === "in-progress").length;
  const pending = actions.filter((a) => a.status === "pending").length;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 section-padding bg-background">
        <div className="container-max">
          <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium mb-4">
                <Wrench className="h-4 w-4" />
                Lean Maintenance Module
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-heading font-bold text-foreground mb-3">
                Lean Maintenance Tracker
              </h1>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Track maintenance actions, monitor before-and-after timestamps, and follow lean recommendations to sustain workplace improvements.
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-10">
              {[
                { label: "Completed", value: completed, color: "text-primary", bg: "bg-primary/10" },
                { label: "In Progress", value: inProgress, color: "text-warning", bg: "bg-warning/10" },
                { label: "Pending", value: pending, color: "text-muted-foreground", bg: "bg-muted" },
              ].map((stat) => (
                <div key={stat.label} className={`rounded-xl ${stat.bg} p-5 text-center`}>
                  <p className={`text-2xl sm:text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Add new action */}
            <div className="bg-card rounded-xl border border-border p-6 mb-8">
              <h3 className="text-base font-heading font-semibold text-card-foreground mb-4 flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                Add Maintenance Action
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <input
                  type="text"
                  placeholder="Area / Zone"
                  value={newArea}
                  onChange={(e) => setNewArea(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  type="text"
                  placeholder="Maintenance task description"
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex gap-2">
                  {(["low", "medium", "high"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setNewPriority(p)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                        newPriority === p
                          ? priorityConfig[p].className + " ring-1 ring-offset-1 ring-ring"
                          : "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {priorityConfig[p].label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={addAction}
                  disabled={!newArea.trim() || !newTask.trim()}
                  className="ml-auto inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="h-4 w-4" />
                  Add Action
                </button>
              </div>
            </div>

            {/* Action Tracker */}
            <div className="bg-card rounded-xl border border-border p-6 sm:p-8 mb-10">
              <h3 className="text-lg font-heading font-semibold text-card-foreground mb-6 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Action Tracker — Timestamp Monitoring
              </h3>
              <div className="space-y-4">
                <AnimatePresence>
                  {actions.map((action) => {
                    const StatusIcon = statusConfig[action.status].icon;
                    return (
                      <motion.div
                        key={action.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="border border-border rounded-lg p-4 bg-background"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <StatusIcon className={`h-4 w-4 flex-shrink-0 ${statusConfig[action.status].className}`} />
                              <span className="text-sm font-semibold text-foreground truncate">{action.task}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${priorityConfig[action.priority].className}`}>
                                {priorityConfig[action.priority].label}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">Area: {action.area}</p>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Created: {formatTimestamp(action.createdAt)}
                              </span>
                              {action.completedAt && (
                                <span className="flex items-center gap-1 text-primary">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Completed: {formatTimestamp(action.completedAt)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <select
                              value={action.status}
                              onChange={(e) => updateStatus(action.id, e.target.value as MaintenanceAction["status"])}
                              className="rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                            >
                              <option value="pending">Pending</option>
                              <option value="in-progress">In Progress</option>
                              <option value="completed">Completed</option>
                            </select>
                            <button
                              onClick={() => removeAction(action.id)}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              aria-label="Remove action"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                {actions.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">No maintenance actions yet. Add one above to get started.</p>
                )}
              </div>
            </div>

            {/* Lean Recommendations */}
            <div className="bg-card rounded-xl border border-border p-6 sm:p-8">
              <h3 className="text-lg font-heading font-semibold text-card-foreground mb-6 flex items-center gap-2">
                <Wrench className="h-5 w-5 text-primary" />
                Lean Maintenance Recommendations
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {leanRecommendations.map((rec, i) => (
                  <div key={i} className="border border-border rounded-lg p-4 bg-background hover:border-primary/30 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="text-sm font-semibold text-foreground">{rec.title}</h4>
                      <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                        {rec.category}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{rec.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default LeanMaintenance;
