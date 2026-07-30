import { Button } from "@/components";
import { ArrowUpRightIcon, SparklesIcon, PlusIcon } from "lucide-react";

interface FollowUpPillsProps {
  items: { label: string; icon?: "arrow" | "sparkles" }[];
  onSelect: (label: string) => void;
}

export const FollowUpPills = ({ items, onSelect }: FollowUpPillsProps) => {
  return (
    <div className="flex w-full items-center gap-2 overflow-x-auto py-2 scrollbar-hide">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pr-2">
        FOLLOW-UPS
      </span>
      {items.map((item, index) => (
        <Button
          key={index}
          variant="outline"
          size="sm"
          onClick={() => onSelect(item.label)}
          className="flex whitespace-nowrap items-center gap-2 rounded-full border-border/50 bg-background/50 hover:bg-muted"
        >
          {item.icon === "arrow" ? (
            <ArrowUpRightIcon className="h-3 w-3" />
          ) : (
            <SparklesIcon className="h-3 w-3" />
          )}
          {item.label}
        </Button>
      ))}
      <div className="flex-1" />
      <Button
        variant="ghost"
        size="sm"
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <PlusIcon className="h-3 w-3" />
        Edit
      </Button>
    </div>
  );
};
