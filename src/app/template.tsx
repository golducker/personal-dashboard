// Re-mounts on every navigation: a short fade + rise for the page content (opacity/transform only).
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter flex flex-1 flex-col">{children}</div>;
}
