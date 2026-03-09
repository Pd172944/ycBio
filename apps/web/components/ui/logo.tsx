import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
  size?: "sm" | "md" | "lg"
}

export function Logo({ className, size = "md" }: LogoProps) {
  const sizes = {
    sm: "h-7 w-7",
    md: "h-9 w-9",
    lg: "h-12 w-12",
  }
  const textSizes = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-2xl",
  }

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className={cn("relative", sizes[size])}>
        {/* DNA helix inspired logo */}
        <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
          <defs>
            <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="50%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
          <circle cx="20" cy="20" r="18" stroke="url(#logo-grad)" strokeWidth="2" fill="none" opacity="0.3" />
          <circle cx="20" cy="20" r="12" stroke="url(#logo-grad)" strokeWidth="1.5" fill="none" opacity="0.5" />
          {/* Helix strands */}
          <path d="M12 10 C16 15, 24 15, 28 10" stroke="#34d399" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M12 18 C16 23, 24 23, 28 18" stroke="#06b6d4" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M12 26 C16 31, 24 31, 28 26" stroke="#8b5cf6" strokeWidth="2" fill="none" strokeLinecap="round" />
          {/* Cross bonds */}
          <line x1="17" y1="12" x2="17" y2="20" stroke="#34d399" strokeWidth="1" opacity="0.5" />
          <line x1="23" y1="12" x2="23" y2="20" stroke="#06b6d4" strokeWidth="1" opacity="0.5" />
          <line x1="20" y1="20" x2="20" y2="28" stroke="#8b5cf6" strokeWidth="1" opacity="0.5" />
          {/* Nodes */}
          <circle cx="17" cy="12" r="1.5" fill="#34d399" />
          <circle cx="23" cy="12" r="1.5" fill="#34d399" />
          <circle cx="17" cy="20" r="1.5" fill="#06b6d4" />
          <circle cx="23" cy="20" r="1.5" fill="#06b6d4" />
          <circle cx="17" cy="28" r="1.5" fill="#8b5cf6" />
          <circle cx="23" cy="28" r="1.5" fill="#8b5cf6" />
        </svg>
      </div>
      <span className={cn("font-bold tracking-tight text-foreground", textSizes[size])}>
        Bio<span className="text-gradient">OS</span>
      </span>
    </div>
  )
}
