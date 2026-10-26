import { Mascot, type MascotPose, type MascotSize } from "./mascot";

/**
 * A mascot with an optional speech bubble. Renders with `display: contents`,
 * so the parent grid places the bubble and the mascot independently.
 */
export function MascotSpeaker({
  line,
  size = "lg",
  pose = "calm",
  mascotClassName = "",
  bubbleClassName = "",
}: {
  line: string | null;
  size?: MascotSize;
  pose?: MascotPose;
  mascotClassName?: string;
  bubbleClassName?: string;
}) {
  return (
    <div className="contents">
      {line && (
        <div className={`bubble ${bubbleClassName}`} role="status" aria-live="polite">
          {line}
        </div>
      )}
      <Mascot size={size} pose={pose} className={mascotClassName} />
    </div>
  );
}
