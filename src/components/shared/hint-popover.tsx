"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CircleHelp, ExternalLink, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

export interface HintLink {
  label: string;
  href: string;
}

export interface HintTip {
  text: string;
}

export interface HintPopoverProps {
  title: string;
  description: string;
  tips?: HintTip[];
  links?: HintLink[];
  /** Icon colour accent — defaults to blue */
  accent?: "blue" | "green" | "purple" | "amber" | "rose";
  /** Placement relative to the trigger */
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}

const ACCENT = {
  blue:   { bg: "bg-blue-50 dark:bg-blue-950/40",   icon: "text-blue-500",   dot: "bg-blue-400"   },
  green:  { bg: "bg-green-50 dark:bg-green-950/40",  icon: "text-green-500",  dot: "bg-green-400"  },
  purple: { bg: "bg-purple-50 dark:bg-purple-950/40",icon: "text-purple-500", dot: "bg-purple-400" },
  amber:  { bg: "bg-amber-50 dark:bg-amber-950/40",  icon: "text-amber-500",  dot: "bg-amber-400"  },
  rose:   { bg: "bg-rose-50 dark:bg-rose-950/40",    icon: "text-rose-500",   dot: "bg-rose-400"   },
};

export function HintPopover({
  title,
  description,
  tips,
  links,
  accent = "blue",
  side = "right",
  className,
}: HintPopoverProps) {
  const a = ACCENT[accent];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Learn more: ${title}`}
          className={cn(
            "inline-flex items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "text-muted-foreground/50 hover:text-primary",
            className
          )}
        >
          <CircleHelp className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        side={side}
        align="start"
        sideOffset={8}
        className="w-72 p-0 overflow-hidden shadow-lg animate-in fade-in-0 zoom-in-95 duration-150"
      >
        {/* Accent header strip */}
        <div className={cn("px-4 py-3 flex items-start gap-3", a.bg)}>
          <span className={cn("mt-0.5 shrink-0", a.icon)}>
            <Lightbulb className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground leading-snug">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
          </div>
        </div>

        {/* Tips */}
        {tips && tips.length > 0 && (
          <div className="px-4 py-3 border-t border-border space-y-1.5">
            {tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className={cn("mt-1.5 h-1.5 w-1.5 rounded-full shrink-0", a.dot)} />
                <p className="text-xs text-muted-foreground leading-relaxed">{tip.text}</p>
              </div>
            ))}
          </div>
        )}

        {/* Links */}
        {links && links.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border flex flex-col gap-1.5">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3 shrink-0" />
                {link.label}
              </a>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
