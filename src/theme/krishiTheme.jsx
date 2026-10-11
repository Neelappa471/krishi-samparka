// src/theme/krishiTheme.jsx
//
// Krishi Samparka visual theme: deep agricultural green, white and golden yellow,
// inspired by a traditional farming identity (sun over green fields).
// It is a COLOUR / STYLE layer only: no layout, markup or behaviour of the
// dashboard changes. Rendered AFTER the dashboard's own CSS so it overrides it.
//
// Palette
//   deep green  #0f3d1e  #14532d  #1f7a3a      leaf green #2f8a3c
//   gold        #f5b82e  (hover #e0a010)       light gold #ffd666  #fff1c2
//   cream       #f6f5e9  #fffbea               ink        #14391c

export const KRISHI_THEME_CSS = `
.ks-fd {
  background: #f6f5e9;
  background-image: radial-gradient(circle at 100% 0, rgba(245, 184, 46, 0.14), rgba(245, 184, 46, 0) 38%);
  color: #1f2a1f;
}

/* ---------- Sidebar: deep green with a golden edge and a field motif ---------- */
.ks-fd-side {
  background: linear-gradient(180deg, #0f3d1e 0%, #14532d 58%, #1f7a3a 100%);
  border-right: 4px solid #f5b82e;
  box-shadow: 4px 0 18px rgba(15, 61, 30, 0.18);
  color: #ffffff;
}
.ks-fd-side::after {
  content: "";
  margin-top: auto;
  height: 92px;
  margin-left: -14px;
  margin-right: -14px;
  margin-bottom: -20px;
  border-radius: 50% 50% 0 0 / 100% 100% 0 0;
  background:
    repeating-linear-gradient(168deg, #3a9b46 0 9px, #2c7f38 9px 18px);
  opacity: 0.9;
}
.ks-fd-brand { gap: 12px; }
.ks-fd-brand-icon {
  width: 48px; height: 48px;
  background: transparent; color: inherit;
  border-radius: 50%;
}
.ks-fd-brand-name {
  font-family: Georgia, "Times New Roman", serif;
  font-size: 22px; font-weight: 800; letter-spacing: 0.2px;
  color: #ffffff;
}
.ks-fd-brand-name::first-letter { color: #ffd666; }
.ks-fd-nav-item { color: #e6f4dc; font-weight: 500; transition: background 0.15s ease; }
.ks-fd-nav-item:hover { background: rgba(255, 255, 255, 0.12); }
.ks-fd-nav-item[aria-current="page"] {
  background: #f5b82e; color: #14391c; font-weight: 700;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.22);
}
.ks-fd-nav-item:focus-visible { outline: 3px solid #ffd666; outline-offset: 2px; }

/* ---------- Header / welcome ---------- */
.ks-fd-header-title { color: #5b6b52; }
.ks-fd-profile { border-color: #dfe8cc; box-shadow: 0 1px 3px rgba(20, 83, 45, 0.08); }
.ks-fd-avatar { background: #fff1c2; color: #14532d; }
.ks-fd-logout, .ks-fd-lang { border-color: #c9d8b3; color: #14532d; }
.ks-fd-logout:hover { background: #fff1c2; border-color: #f5b82e; }
.ks-fd-lang:focus-visible { outline: 3px solid #f5b82e; }
.ks-fd-welcome h1 { color: #0f3d1e; font-weight: 800; letter-spacing: -0.01em; }
.ks-fd-welcome p { color: #4d5d45; }

/* ---------- Hero banner: sun rising over green fields ---------- */
.ks-fd-hero {
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #0f3d1e 0%, #14532d 55%, #1f7a3a 100%);
  border-radius: 22px;
  box-shadow: 0 10px 28px rgba(15, 61, 30, 0.25);
}
.ks-fd-hero > * { position: relative; z-index: 1; }
.ks-fd-hero::before {
  content: "";
  position: absolute; z-index: 0;
  right: -50px; top: -95px;
  width: 240px; height: 240px; border-radius: 50%;
  background: radial-gradient(circle, #ffd666 0%, #f5b82e 52%, rgba(245, 184, 46, 0) 72%);
  opacity: 0.9;
  pointer-events: none;
}
.ks-fd-hero::after {
  content: "";
  position: absolute; z-index: 0;
  left: 0; right: 0; bottom: 0; height: 8px;
  background: repeating-linear-gradient(90deg, #3a9b46 0 18px, #f5b82e 18px 36px);
  pointer-events: none;
}
.ks-fd-hero-label { color: #ffd666; opacity: 0.95; font-weight: 700; }
.ks-fd-hero-value { color: #ffd666; }

/* ---------- Cards ---------- */
.ks-fd-card {
  background: #ffffff;
  border: 1px solid #dfe8cc;
  border-radius: 18px;
  box-shadow: 0 1px 3px rgba(20, 83, 45, 0.07);
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}
.ks-fd-card:hover {
  border-color: #f5b82e; background: #fffdf4;
  box-shadow: 0 10px 22px rgba(20, 83, 45, 0.13);
  transform: translateY(-2px);
}
.ks-fd-card:focus-visible { outline: 3px solid #f5b82e; outline-offset: 2px; }
.ks-fd-card-icon {
  background: linear-gradient(135deg, #14532d, #1f7a3a);
  color: #ffd666;
  border-radius: 14px;
}
.ks-fd-card:hover .ks-fd-card-icon { background: #f5b82e; color: #14391c; }
.ks-fd-card-title { color: #0f3d1e; font-weight: 700; }
.ks-fd-item, .ks-fd-searchbar {
  border-color: #dfe8cc;
  box-shadow: 0 1px 3px rgba(20, 83, 45, 0.07);
}
.ks-fd-item { border-top: 3px solid #14532d; }
.ks-fd-searchbar { border-top: 4px solid #f5b82e; }
.ks-fd-section-head h2, .ks-fd-section-head h1 { color: #0f3d1e; font-weight: 800; }
.ks-fd-section-sub { color: #5b6b52; }

/* ---------- Buttons: golden primary actions ---------- */
.ks-fd-submit, .ks-fd-search-btn, .ks-fd-match-buyer-btn {
  background: linear-gradient(180deg, #f8c64a, #f5b82e);
  color: #14391c;
  font-weight: 700;
  box-shadow: 0 2px 0 #c98f0a;
  transition: background 0.15s ease, transform 0.1s ease;
}
.ks-fd-submit:hover:not(:disabled),
.ks-fd-search-btn:hover:not(:disabled),
.ks-fd-match-buyer-btn:hover:not(:disabled) {
  background: linear-gradient(180deg, #f5b82e, #e0a010);
}
.ks-fd-submit:active:not(:disabled),
.ks-fd-search-btn:active:not(:disabled) { transform: translateY(1px); box-shadow: none; }
.ks-fd-submit:focus-visible,
.ks-fd-search-btn:focus-visible,
.ks-fd-match-buyer-btn:focus-visible { outline: 3px solid #14532d; outline-offset: 2px; }
.ks-fd-input:focus-visible { outline: 3px solid #f5b82e; outline-offset: 1px; }

/* ---------- Market opportunity cards (golden, "sun" accent) ---------- */
.ks-fd-opp {
  background: #fffbea;
  border: 1px solid #f3dd95;
  border-left: 5px solid #f5b82e;
  box-shadow: 0 2px 8px rgba(224, 160, 16, 0.12);
}
.ks-fd-opp-title { color: #14532d; font-weight: 800; }
.ks-fd-badge {
  background: #fff1c2; color: #6b4300;
  border: 1px solid #f3dd95; font-weight: 700;
}
.ks-fd-fact-value { color: #0f3d1e; }

/* ---------- Market price table ---------- */
.ks-fd-price-table th {
  background: #14532d; color: #ffffff; font-weight: 600;
}
.ks-fd-price-table tbody tr:hover { background: #fffbea; }

/* ---------- Mobile: sidebar becomes a green top bar ---------- */
@media (max-width: 720px) {
  .ks-fd-side {
    border-right: none; border-bottom: 4px solid #f5b82e;
    box-shadow: 0 4px 14px rgba(15, 61, 30, 0.18);
  }
  .ks-fd-side::after { display: none; }
  .ks-fd-brand-icon { width: 40px; height: 40px; }
  .ks-fd-hero::before { width: 170px; height: 170px; right: -40px; top: -70px; }
}

@media (prefers-reduced-motion: reduce) {
  .ks-fd-card, .ks-fd-nav-item, .ks-fd-submit, .ks-fd-search-btn { transition: none; }
  .ks-fd-card:hover { transform: none; }
}
`;

// Round emblem drawn in code: sun rising over green fields (no image file).
export function KrishiEmblem({ size = 44 }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label="Krishi Samparka"
    >
      <defs>
        <clipPath id="ks-emblem-clip">
          <circle cx="32" cy="32" r="27" />
        </clipPath>
      </defs>
      <circle cx="32" cy="32" r="30" fill="#ffffff" stroke="#f5b82e" strokeWidth="3" />
      <g clipPath="url(#ks-emblem-clip)">
        <rect width="64" height="64" fill="#fde9a8" />
        <circle cx="32" cy="35" r="15" fill="#f5b82e" />
        <path d="M0 40 Q16 31 32 38 T64 35 V64 H0 Z" fill="#2f8a3c" />
        <path d="M0 46 Q22 40 64 48 V64 H0 Z" fill="#14532d" />
        <path d="M6 64 L26 46 M18 64 L34 47 M30 64 L42 48 M42 64 L50 49" stroke="#3a9b46" strokeWidth="2" fill="none" />
      </g>
      <circle cx="32" cy="32" r="27" fill="none" stroke="#14532d" strokeWidth="2.5" />
    </svg>
  );
}
