// Fixed, non-interactive background per world. CSS animations only (transform/opacity), at most ~12 animated nodes
// are visible at a time because the inactive world is display:none.

const SPARKS = [
  { left: "8%", top: "22%", delay: "0s", dur: "7s" },
  { left: "18%", top: "68%", delay: "1.4s", dur: "6s" },
  { left: "31%", top: "40%", delay: "3.1s", dur: "8s" },
  { left: "47%", top: "82%", delay: "0.6s", dur: "6.5s" },
  { left: "58%", top: "18%", delay: "2.2s", dur: "7.5s" },
  { left: "72%", top: "56%", delay: "4s", dur: "6s" },
  { left: "86%", top: "30%", delay: "1.1s", dur: "8s" },
  { left: "93%", top: "74%", delay: "3.6s", dur: "7s" },
];

const BUBBLES = [
  { left: "6%", size: 22, delay: "-3s", dur: "26s" },
  { left: "19%", size: 12, delay: "-11s", dur: "21s" },
  { left: "34%", size: 30, delay: "-18s", dur: "32s" },
  { left: "52%", size: 16, delay: "-7s", dur: "24s" },
  { left: "67%", size: 26, delay: "-14s", dur: "29s" },
  { left: "81%", size: 14, delay: "-1s", dur: "22s" },
  { left: "92%", size: 20, delay: "-20s", dur: "27s" },
];

export function Ambient() {
  return (
    <>
      <div className="ambient only-dark" aria-hidden>
        <span className="amb-blob amb-blob-1" />
        <span className="amb-blob amb-blob-2" />
        <span className="amb-blob amb-blob-3" />
        <span className="amb-fog" />
        {SPARKS.map((s, i) => (
          <span key={i} className="amb-spark" style={{ left: s.left, top: s.top, animationDelay: s.delay, animationDuration: s.dur }} />
        ))}
      </div>
      <div className="ambient only-light" aria-hidden>
        <span className="amb-sun" />
        {BUBBLES.map((b, i) => (
          <span
            key={i}
            className="amb-bubble"
            style={{ left: b.left, width: b.size, height: b.size, animationDelay: b.delay, animationDuration: b.dur }}
          />
        ))}
        <span className="amb-q" style={{ left: "74%", animationDelay: "-9s" }}>
          ?
        </span>
      </div>
      <div className="grain" aria-hidden />
    </>
  );
}
