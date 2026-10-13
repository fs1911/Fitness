import { CheckCircle2, Pause, PlayCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { SESSION_STATUS_LABELS, type SessionStatus } from "@/domain/types";

/** Status mit Icon UND Text – nie nur über Farbe. */
export function SessionStatusBadge({ status }: { status: SessionStatus }) {
  const map = {
    completed: { tone: "success" as const, Icon: CheckCircle2 },
    aborted: { tone: "danger" as const, Icon: XCircle },
    in_progress: { tone: "accent" as const, Icon: PlayCircle },
    paused: { tone: "warning" as const, Icon: Pause },
  }[status];
  return (
    <Badge tone={map.tone}>
      <map.Icon aria-hidden /> {SESSION_STATUS_LABELS[status]}
    </Badge>
  );
}
