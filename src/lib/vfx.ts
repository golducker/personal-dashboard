// Small DOM-only visual effects (Web Animations API, transform/opacity only). Client only.

const DARK_COLORS = ["#a08ae0", "#b6a5ea", "#cbbff2", "#ecebf2"];
const LIGHT_COLORS = ["#f3bb2b", "#e0a414", "#fbe7a8", "#8d6106"];

function isDark(): boolean {
  const t = document.documentElement.dataset.theme;
  if (t === "light" || t === "dark") return t === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function layer(): HTMLElement {
  let el = document.getElementById("fx-layer");
  if (!el) {
    el = document.createElement("div");
    el.id = "fx-layer";
    el.className = "fx-layer";
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
  }
  return el;
}

/** Particle burst at viewport coordinates: purple/pink sparks (Gengar) or yellow stars (Psyduck). */
export function burst(x: number, y: number) {
  if (typeof document === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const dark = isDark();
  const colors = dark ? DARK_COLORS : LIGHT_COLORS;
  const host = layer();
  const n = 14;
  for (let i = 0; i < n; i++) {
    const el = document.createElement("span");
    el.className = `fx-p ${dark ? "fx-spark" : "fx-star"}`;
    const color = colors[i % colors.length];
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.background = color;
    el.style.color = color;
    host.appendChild(el);
    const angle = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const dist = 34 + Math.random() * 38;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 8;
    const rot = (Math.random() - 0.5) * 240;
    const anim = el.animate(
      [
        { transform: "translate(-50%, -50%) scale(0.2)", opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${rot}deg) scale(1)`, opacity: 1, offset: 0.55 },
        { transform: `translate(calc(-50% + ${dx * 1.15}px), calc(-50% + ${dy * 1.15 + 14}px)) rotate(${rot * 1.4}deg) scale(0.3)`, opacity: 0 },
      ],
      { duration: 620 + Math.random() * 220, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", fill: "forwards" },
    );
    anim.onfinish = () => el.remove();
  }
}

/** Burst centred on an element. */
export function burstFrom(el: Element | null) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2);
}
