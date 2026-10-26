"use client";

import { useState } from "react";
import type { Lines } from "@/lib/mascot-lines";
import { Mascot, type MascotPose, type MascotSize } from "./mascot";

/**
 * A mascot with a speech bubble. Clicking the mascot cycles through the context lines of each character.
 * Renders with `display: contents`, so the parent grid places the bubble and the mascot independently.
 */
export function MascotSpeaker({
  lines,
  size = "lg",
  pose = "calm",
  mascotClassName = "",
  bubbleClassName = "",
}: {
  lines: Lines;
  size?: MascotSize;
  pose?: MascotPose;
  mascotClassName?: string;
  bubbleClassName?: string;
}) {
  const [i, setI] = useState(0);
  const pick = (list: string[]) => list[i % list.length];
  return (
    <div className="contents">
      <div key={i} className={`bubble ${bubbleClassName}`} role="status" aria-live="polite">
        <span className="only-light">{pick(lines.light)}</span>
        <span className="only-dark">{pick(lines.dark)}</span>
      </div>
      <Mascot size={size} pose={pose} className={mascotClassName} onPoke={() => setI((n) => n + 1)} label="Linh vật, bấm để nghe câu khác" />
    </div>
  );
}

/** A bubble with fixed lines per character (login, 404). */
export function Bubble({ light, dark, className = "" }: { light: string; dark: string; className?: string }) {
  return (
    <div className={`bubble ${className}`}>
      <span className="only-light">{light}</span>
      <span className="only-dark">{dark}</span>
    </div>
  );
}
