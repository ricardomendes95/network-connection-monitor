import { NavLink } from "react-router-dom";
import { LayoutDashboard, BarChart2, History, Settings } from "lucide-react";
import { cn } from "../../lib/utils";
import logo from "../../assets/logo.png";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/charts", label: "Gráficos", icon: BarChart2 },
  { to: "/history", label: "Histórico", icon: History },
  { to: "/settings", label: "Configurações", icon: Settings },
];

export function Sidebar(): JSX.Element {
  return (
    <aside className="w-56 flex-shrink-0 bg-card border-r border-border flex flex-col">
      <div className="flex items-center gap-2 px-4 py-5 border-b border-border">
        <img
          src={logo}
          alt="Caiu aí?"
          className="w-48 h-48 object-contain"
        />
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent",
              )
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
