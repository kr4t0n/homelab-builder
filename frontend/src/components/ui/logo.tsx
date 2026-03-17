import { cn } from "../../lib/utils";

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  variant?: "default" | "loading" | "error";
  interactive?: boolean;
}

export function Logo({ className, variant = "default", interactive: _interactive = false, ...props }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className={cn(
        variant === "error" ? "grayscale opacity-80" : "",
        className
      )}
      {...props}
    >
      <defs>
        <linearGradient id="logo-orbit-grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id="logo-orbit-grad2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.1" />
        </linearGradient>
        <radialGradient id="logo-sun-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fcd34d" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
        <filter id="logo-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <rect width="100" height="100" rx="22" fill="#0f172a" />

      <ellipse cx="50" cy="50" rx="35" ry="12"
        transform="rotate(30 50 50)" fill="none" stroke="url(#logo-orbit-grad1)" strokeWidth="1.5" />
      <ellipse cx="50" cy="50" rx="35" ry="12"
        transform="rotate(150 50 50)" fill="none" stroke="url(#logo-orbit-grad2)" strokeWidth="1.5" />

      <circle cx="50" cy="50" r="7" fill="url(#logo-sun-grad)" filter="url(#logo-glow)" />

      <circle cx="80.31" cy="67.5" r="2.5" fill="#38bdf8" filter="url(#logo-glow)" />
      <circle cx="80.31" cy="32.5" r="2" fill="#818cf8" filter="url(#logo-glow)" />
      <circle cx="56" cy="39.61" r="1.5" fill="#cbd5e1" opacity="0.8" />
    </svg>
  );
}
