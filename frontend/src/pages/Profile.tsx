import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { User, BadgeCheck, Building2, LogOut } from "lucide-react";

const Profile = () => {
  const { employee, office, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (!employee) {
    navigate("/login");
    return null;
  }

  const initials = employee.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 section-padding bg-background">
        <div className="container-max">
          <div className="max-w-lg mx-auto">
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-foreground mb-8">My Profile</h1>

            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              {/* Header */}
              <div className="bg-primary/10 px-6 py-8 flex flex-col items-center gap-3">
                <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold font-heading shadow-md">
                  {initials}
                </div>
                <div className="text-center">
                  <p className="text-xl font-heading font-bold text-foreground">{employee.name}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{employee.department}</p>
                </div>
              </div>

              {/* Details */}
              <div className="px-6 py-6 space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 border border-border">
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Full Name</p>
                    <p className="text-sm font-semibold text-foreground mt-0.5">{employee.name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 border border-border">
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BadgeCheck className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Employee ID</p>
                    <p className="text-sm font-semibold text-foreground mt-0.5">{employee.employeeId}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 border border-border">
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Department</p>
                    <p className="text-sm font-semibold text-foreground mt-0.5">{employee.department}</p>
                  </div>
                </div>

                {office && (
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 border border-border">
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Selected Office</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">{office.name}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="px-6 pb-6">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-6 py-3 text-sm font-semibold text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Profile;
