/* Line icons for the 9 interest areas (no emoji). */
const PATHS: Record<string, string> = {
  "Software development": "M8 9l-4 3 4 3M16 9l4 3-4 3M13.5 6l-3 12",
  "Systems analysis": "M4 5h7v6H4zM13 13h7v6h-7zM7.5 11v4h5.5M16.5 13V9H11",
  "Databases and data management": "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zm0 0v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  "Quality assurance": "M12 3l7 3v5c0 4.4-3 8.3-7 10-4-1.7-7-5.6-7-10V6zM9 12l2 2 4-4",
  "UI/UX design": "M4 5h16v11H4zM8 20h8M12 16v4M8 9h5M8 12h8",
  "Data science and AI": "M4 19V5M4 19h16M8 15l3-4 3 2 5-6",
  "Infrastructure and cloud": "M7 18a4 4 0 01-.6-8A6 6 0 0118 9a4.5 4.5 0 01-.5 9z",
  "Security": "M7 11V8a5 5 0 0110 0v3M5 11h14v10H5zM12 15v2",
  "IT service and management": "M9 5h6M9 3h6v4H9zM7 5H5v16h14V5h-2M9 12h6M9 16h4",
};

// any other field (O*NET or added by the admin)
const BRIEFCASE = "M4 8h16v11H4zM9 8V5h6v3M4 13h16";

export function AreaIcon({ area, className = "w-5 h-5" }: { area: string; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
      <path d={PATHS[area] || BRIEFCASE} />
    </svg>
  );
}
