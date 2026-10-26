// Fixed, non-interactive background per world: one static light source at the top plus a faint grain.
// Nothing animates here, so the page content and the mascots are the only things that move.

export function Ambient() {
  return (
    <>
      <div className="ambient only-dark" aria-hidden>
        <span className="amb-glow amb-glow-dark" />
      </div>
      <div className="ambient only-light" aria-hidden>
        <span className="amb-glow amb-glow-light" />
      </div>
      <div className="grain" aria-hidden />
    </>
  );
}
