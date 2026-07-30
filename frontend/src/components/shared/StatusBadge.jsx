import { cn } from "@/lib/utils";

const statusStyles = {
  pending: "bg-warning/10 text-warning border-warning/30",
  approved: "bg-success/10 text-success border-success/30",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
  none: "bg-muted text-muted-foreground border-border",
};

const StatusBadge = ({
  status
}) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold capitalize",
      statusStyles[status]
    )}>
    {status}
  </span>
);

export default StatusBadge;
