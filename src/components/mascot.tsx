"use client";

import Image from "next/image";
import { useRef } from "react";
import { sfx } from "@/lib/sfx";

export type MascotSize = "sm" | "md" | "lg";
/** calm: everyday; panic: overdue work or a locked door; lost: 404, empty lists. */
export type MascotPose = "calm" | "panic" | "lost";

const SIZES: Record<MascotSize, { px: number; sizes: string }> = {
  sm: { px: 512, sizes: "48px" },
  md: { px: 512, sizes: "128px" },
  lg: { px: 512, sizes: "208px" },
};

const BOUNCE: Keyframe[] = [
  { transform: "translateY(0) scale(1, 1)", offset: 0 },
  { transform: "translateY(0) scale(1.14, 0.84)", offset: 0.18 },
  { transform: "translateY(-16%) scale(0.92, 1.1)", offset: 0.45 },
  { transform: "translateY(0) scale(1.08, 0.92)", offset: 0.7 },
  { transform: "translateY(0) scale(1, 1)", offset: 1 },
];

/** Both characters are in the DOM; CSS shows the one for the current theme (no JS, no flash). */
function Poses({ pose, px, sizes }: { pose: MascotPose; px: number; sizes: string }) {
  return (
    <>
      <span className="mascot-pose psy only-light">
        <Image src={`/mascots/psyduck-${pose}.webp`} alt="" width={px} height={px} sizes={sizes} draggable={false} unoptimized loading="eager" />
      </span>
      <span className="mascot-pose gen only-dark">
        <Image src={`/mascots/gengar-${pose}.webp`} alt="" width={px} height={px} sizes={sizes} draggable={false} unoptimized loading="eager" />
      </span>
    </>
  );
}

/** Psyduck is the light world, Gengar the dark one; art lives in public/mascots/{psyduck,gengar}-{pose}.webp. */
export function Mascot({
  size = "md",
  pose = "calm",
  className = "",
  onPoke,
  label = "Linh vật",
}: {
  size?: MascotSize;
  pose?: MascotPose;
  className?: string;
  onPoke?: () => void;
  label?: string;
}) {
  const root = useRef<HTMLButtonElement>(null);
  const s = SIZES[size];

  function poke() {
    sfx.mascot();
    const poses = root.current?.querySelectorAll<HTMLElement>(".mascot-pose") ?? [];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) {
      for (const p of poses) p.animate(BOUNCE, { duration: 640, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" });
    }
    onPoke?.();
  }

  return (
    <button
      ref={root}
      type="button"
      onClick={poke}
      data-sfx="none"
      data-pose={pose}
      aria-label={label}
      className={`mascot mascot-${size} ${className}`}
    >
      <span className="mascot-shadow" aria-hidden />
      <span className="mascot-body">
        <Poses pose={pose} px={s.px} sizes={s.sizes} />
      </span>
    </button>
  );
}

/** Static (non-interactive) mascot for decorative spots such as empty states. */
export function MascotStatic({ size = "sm", pose = "lost", className = "" }: { size?: MascotSize; pose?: MascotPose; className?: string }) {
  const s = SIZES[size];
  return (
    <span className={`mascot mascot-${size} !cursor-default ${className}`} data-pose={pose} aria-hidden>
      <span className="mascot-body">
        <Poses pose={pose} px={s.px} sizes={s.sizes} />
      </span>
    </span>
  );
}
