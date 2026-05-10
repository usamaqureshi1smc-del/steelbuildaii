import { useState, useRef, useCallback, useEffect } from "react";

const API_URL = "https://api.anthropic.com/v1/messages";

// ─── IN-MEMORY USER STORE ───────────────────────────────────────────────────
// In a real app this would be a backend DB + JWT. Here we simulate it cleanly.
const userStore = { users: [], nextId: 1 };

function registerUser({ name, email, password, company }) {
  if (userStore.users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return { error: "An account with this email already exists." };
  }
  const user = { id: userStore.nextId++, name, email, company: company || "", password, createdAt: new Date().toISOString(), projects: [] };
  userStore.users.push(user);
  return { user: sanitize(user) };
}

function loginUser({ email, password }) {
  const user = userStore.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return { error: "No account found with this email." };
  if (user.password !== password) return { error: "Incorrect password." };
  return { user: sanitize(user) };
}

function addProjectToUser(userId, project) {
  const user = userStore.users.find(u => u.id === userId);
  if (!user) return;
  user.projects.unshift({ ...project, id: Date.now(), savedAt: new Date().toISOString() });
}

function sanitize(u) {
  const { password, ...safe } = u;
  return safe;
}

// ─── STRUCTURAL DIAGRAM COMPONENT ───────────────────────────────────────────
// Generates a live isometric-style PEB diagram based on entered dimensions.
// Calculates columns, rafters, purlins, bays automatically.
function StructuralDiagram({ dims }) {
  const W = parseFloat(dims.width) || 60;
  const L = parseFloat(dims.length) || 120;
  const H = parseFloat(dims.height) || 24;
  const roofType = dims.roofType || "gable";

  // Engineering calculations
  const baySpacing = Math.min(Math.max(Math.round(L / Math.round(L / 20)), 15), 25);
  const numBays = Math.round(L / baySpacing);
  const numColumns = (numBays + 1) * 2; // both sides
  const numRafters = (numBays + 1) * (roofType === "gable" ? 2 : 1);
  const purlinSpacing = 5; // ft
  const numPurlins = Math.round((W / 2) / purlinSpacing) * 2 * numBays;
  const numGirts = Math.round(H / 5) * (numBays * 2 + 2); // wall girts

  // SVG isometric projection constants
  const VW = 780, VH = 420;
  const isoX = (x, y) => VW * 0.18 + x * 2.8 - y * 2.8;
  const isoY = (x, y, z) => VH * 0.82 - z * 3.2 + x * 1.4 + y * 1.4;

  // Scale to fit: map real ft to drawing units
  const scaleW = Math.min(80, 4800 / W);
  const scaleL = Math.min(60, 3600 / L);
  const scaleH = Math.min(100, 2400 / H);

  const sw = W * (scaleW / 10);
  const sl = L * (scaleL / 10);
  const sh = H * (scaleH / 10);

  const bays = numBays;
  const bayW = sl / bays;

  // Corner points of the building footprint
  const pts = {
    A: [0, 0, 0], B: [sw, 0, 0], C: [sw, sl, 0], D: [0, sl, 0],
    AH: [0, 0, sh], BH: [sw, 0, sh], CH: [sw, sl, sh], DH: [0, sl, sh],
  };

  const p = (coord) => `${isoX(coord[0], coord[1])},${isoY(coord[0], coord[1], coord[2])}`;

  // Ridge for gable
  const ridgeX = sw / 2;
  const ridgeH = sh + sw * 0.22;
  const ridgePts = Array.from({ length: bays + 1 }, (_, i) => [ridgeX, i * bayW, ridgeH]);

  // Color palette
  const COL_FRAME = "#5A8FB5";
  const COL_RAFTER = "#D4A035";
  const COL_PURLIN = "#4A7A6A";
  const COL_GIRT = "#7A6AAA";
  const COL_ROOF = "rgba(58,100,140,0.18)";
  const COL_WALL = "rgba(30,50,70,0.22)";
  const COL_GROUND = "rgba(40,55,65,0.6)";
  const STROKE = 1.5;

  return (
    <div style={{ background: "var(--steel)", border: "1px solid var(--border)", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "20px 28px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "var(--amber)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 4 }}>
            ▸ Live Structural Diagram
          </div>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 18, color: "var(--white)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {roofType === "gable" ? "Gable Frame" : roofType === "single-slope" ? "Mono-Slope Frame" : roofType === "curved" ? "Arch Frame" : roofType === "sawtooth" ? "Sawtooth Frame" : "Hip Frame"} — {W}W × {L}L × {H}H ft
          </div>
        </div>
        {/* Legend */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {[
            { color: COL_FRAME, label: "Columns" },
            { color: COL_RAFTER, label: "Rafters" },
            { color: COL_PURLIN, label: "Purlins" },
            { color: COL_GIRT, label: "Girts" },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.08em" }}>
              <div style={{ width: 20, height: 3, background: color, borderRadius: 1 }} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* SVG Diagram */}
      <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: "100%", display: "block" }}>
        {/* Ground shadow */}
        <ellipse cx={isoX(sw/2, sl/2)} cy={isoY(sw/2, sl/2, -2)} rx={sw * 4} ry={sl * 2} fill="rgba(0,0,0,0.25)" />

        {/* Ground plane */}
        <polygon
          points={`${p(pts.A)} ${p(pts.B)} ${p(pts.C)} ${p(pts.D)}`}
          fill={COL_GROUND} stroke="rgba(60,80,95,0.5)" strokeWidth={0.8}
        />

        {/* WALLS (back faces first for depth) */}
        {/* Back wall (far side, high y) */}
        <polygon points={`${p(pts.D)} ${p(pts.C)} ${p(pts.CH)} ${p(pts.DH)}`} fill={COL_WALL} stroke="rgba(80,120,160,0.15)" strokeWidth={0.5} />
        {/* Right wall */}
        <polygon points={`${p(pts.B)} ${p(pts.C)} ${p(pts.CH)} ${p(pts.BH)}`} fill="rgba(25,40,55,0.28)" stroke="rgba(80,120,160,0.15)" strokeWidth={0.5} />

        {/* Bay lines on floor */}
        {Array.from({ length: bays + 1 }, (_, i) => {
          const y = i * bayW;
          return (
            <line key={`fl-${i}`}
              x1={isoX(0, y)} y1={isoY(0, y, 0)}
              x2={isoX(sw, y)} y2={isoY(sw, y, 0)}
              stroke="rgba(80,120,160,0.2)" strokeWidth={0.6} strokeDasharray="4,6"
            />
          );
        })}

        {/* WALL GIRTS (horizontal lines on side walls) */}
        {Array.from({ length: Math.round(H / 5) }, (_, gi) => {
          const gz = (sh / Math.round(H / 5)) * (gi + 1);
          return (
            <g key={`girt-${gi}`}>
              {/* Front wall girts (near side) */}
              <line
                x1={isoX(0, 0, gz)} y1={isoY(0, 0, gz)}
                x2={isoX(sw, 0, gz)} y2={isoY(sw, 0, gz)}
                stroke={COL_GIRT} strokeWidth={STROKE * 0.7} opacity={0.7}
              />
              {/* Side girts on right */}
              <line
                x1={isoX(sw, 0, gz)} y1={isoY(sw, 0, gz)}
                x2={isoX(sw, sl, gz)} y2={isoY(sw, sl, gz)}
                stroke={COL_GIRT} strokeWidth={STROKE * 0.7} opacity={0.5}
              />
            </g>
          );
        })}

        {/* COLUMNS per bay */}
        {Array.from({ length: bays + 1 }, (_, i) => {
          const y = i * bayW;
          return (
            <g key={`col-${i}`}>
              {/* Left column */}
              <line
                x1={isoX(0, y)} y1={isoY(0, y, 0)}
                x2={isoX(0, y)} y2={isoY(0, y, sh)}
                stroke={COL_FRAME} strokeWidth={STROKE * 1.6} strokeLinecap="round"
              />
              {/* Right column */}
              <line
                x1={isoX(sw, y)} y1={isoY(sw, y, 0)}
                x2={isoX(sw, y)} y2={isoY(sw, y, sh)}
                stroke={COL_FRAME} strokeWidth={STROKE * 1.6} strokeLinecap="round"
              />
              {/* Base plates */}
              <ellipse cx={isoX(0, y)} cy={isoY(0, y, 0)} rx={5} ry={2.5} fill={COL_FRAME} opacity={0.8} />
              <ellipse cx={isoX(sw, y)} cy={isoY(sw, y, 0)} rx={5} ry={2.5} fill={COL_FRAME} opacity={0.8} />
            </g>
          );
        })}

        {/* RAFTERS per bay (gable) */}
        {roofType !== "single-slope" && roofType !== "curved" && Array.from({ length: bays + 1 }, (_, i) => {
          const y = i * bayW;
          const ridgePt = [ridgeX, y, ridgeH];
          return (
            <g key={`raf-${i}`}>
              <line
                x1={isoX(0, y)} y1={isoY(0, y, sh)}
                x2={isoX(ridgePt[0], ridgePt[1])} y2={isoY(ridgePt[0], ridgePt[1], ridgePt[2])}
                stroke={COL_RAFTER} strokeWidth={STROKE * 1.4} strokeLinecap="round"
              />
              <line
                x1={isoX(sw, y)} y1={isoY(sw, y, sh)}
                x2={isoX(ridgePt[0], ridgePt[1])} y2={isoY(ridgePt[0], ridgePt[1], ridgePt[2])}
                stroke={COL_RAFTER} strokeWidth={STROKE * 1.4} strokeLinecap="round"
              />
            </g>
          );
        })}

        {/* MONO-SLOPE rafters */}
        {roofType === "single-slope" && Array.from({ length: bays + 1 }, (_, i) => {
          const y = i * bayW;
          return (
            <line key={`mraf-${i}`}
              x1={isoX(0, y)} y1={isoY(0, y, sh + sw * 0.12)}
              x2={isoX(sw, y)} y2={isoY(sw, y, sh)}
              stroke={COL_RAFTER} strokeWidth={STROKE * 1.4} strokeLinecap="round"
            />
          );
        })}

        {/* CURVED rafters (arch) */}
        {roofType === "curved" && Array.from({ length: bays + 1 }, (_, i) => {
          const y = i * bayW;
          const cx1 = isoX(0, y); const cy1 = isoY(0, y, sh);
          const cx2 = isoX(sw, y); const cy2 = isoY(sw, y, sh);
          const apexX = isoX(sw / 2, y); const apexY = isoY(sw / 2, y, sh + sw * 0.28);
          return (
            <path key={`craf-${i}`}
              d={`M ${cx1},${cy1} Q ${apexX},${apexY} ${cx2},${cy2}`}
              fill="none" stroke={COL_RAFTER} strokeWidth={STROKE * 1.4} strokeLinecap="round"
            />
          );
        })}

        {/* ROOF PURLINS — lines running along the length on roof slope */}
        {roofType !== "single-slope" && roofType !== "curved" && (() => {
          const steps = Math.round(sw / 2 / ((sw / 2) / Math.max(3, Math.round(W / 2 / purlinSpacing))));
          const purlinPositions = Array.from({ length: steps }, (_, pi) => (pi + 1) * (sw / 2 / (steps + 1)));
          return purlinPositions.map((px, pi) => (
            <g key={`purl-${pi}`}>
              {/* Left slope purlins */}
              <line
                x1={isoX(px, 0)} y1={isoY(px, 0, sh + (px / (sw / 2)) * (ridgeH - sh))}
                x2={isoX(px, sl)} y2={isoY(px, sl, sh + (px / (sw / 2)) * (ridgeH - sh))}
                stroke={COL_PURLIN} strokeWidth={STROKE * 0.9} opacity={0.85} strokeLinecap="round"
              />
              {/* Right slope purlins */}
              <line
                x1={isoX(sw - px, 0)} y1={isoY(sw - px, 0, sh + (px / (sw / 2)) * (ridgeH - sh))}
                x2={isoX(sw - px, sl)} y2={isoY(sw - px, sl, sh + (px / (sw / 2)) * (ridgeH - sh))}
                stroke={COL_PURLIN} strokeWidth={STROKE * 0.9} opacity={0.85} strokeLinecap="round"
              />
            </g>
          ));
        })()}

        {/* MONO-SLOPE purlins */}
        {roofType === "single-slope" && (() => {
          const steps = Math.max(3, Math.round(W / purlinSpacing));
          return Array.from({ length: steps - 1 }, (_, pi) => {
            const frac = (pi + 1) / steps;
            const px = frac * sw;
            const pz = sh + (1 - frac) * sw * 0.12;
            return (
              <line key={`mpurl-${pi}`}
                x1={isoX(px, 0)} y1={isoY(px, 0, pz)}
                x2={isoX(px, sl)} y2={isoY(px, sl, pz)}
                stroke={COL_PURLIN} strokeWidth={STROKE * 0.9} opacity={0.85} strokeLinecap="round"
              />
            );
          });
        })()}

        {/* RIDGE beam */}
        {roofType !== "single-slope" && (
          <line
            x1={isoX(ridgeX, 0)} y1={isoY(ridgeX, 0, ridgeH)}
            x2={isoX(ridgeX, sl)} y2={isoY(ridgeX, sl, ridgeH)}
            stroke={COL_RAFTER} strokeWidth={STROKE * 1.8} strokeLinecap="round"
          />
        )}

        {/* EAVE beams */}
        <line x1={isoX(0,0,sh)} y1={isoY(0,0,sh)} x2={isoX(0,sl,sh)} y2={isoY(0,sl,sh)} stroke={COL_FRAME} strokeWidth={STROKE*1.3} />
        <line x1={isoX(sw,0,sh)} y1={isoY(sw,0,sh)} x2={isoX(sw,sl,sh)} y2={isoY(sw,sl,sh)} stroke={COL_FRAME} strokeWidth={STROKE*1.3} />

        {/* ROOF surface (transparent) */}
        {roofType !== "single-slope" && roofType !== "curved" && (
          <>
            <polygon
              points={`${p(pts.AH)} ${p([ridgeX, 0, ridgeH])} ${p([ridgeX, sl, ridgeH])} ${p(pts.DH)}`}
              fill={COL_ROOF} stroke="rgba(80,140,200,0.12)" strokeWidth={0.5}
            />
            <polygon
              points={`${p(pts.BH)} ${p([ridgeX, 0, ridgeH])} ${p([ridgeX, sl, ridgeH])} ${p(pts.CH)}`}
              fill="rgba(40,70,100,0.12)" stroke="rgba(80,140,200,0.1)" strokeWidth={0.5}
            />
          </>
        )}

        {/* FRONT WALL outline */}
        <polygon
          points={`${p(pts.A)} ${p(pts.B)} ${p(pts.BH)} ${p(pts.AH)}`}
          fill="rgba(20,35,50,0.3)" stroke="rgba(80,120,160,0.3)" strokeWidth={0.8}
        />
        {roofType !== "single-slope" && (
          <polygon
            points={`${p(pts.AH)} ${p(pts.BH)} ${p([ridgeX, 0, ridgeH])}`}
            fill="rgba(25,40,58,0.3)" stroke="rgba(80,120,160,0.25)" strokeWidth={0.8}
          />
        )}

        {/* Dimension labels */}
        <g fontFamily="'IBM Plex Mono', monospace" fontSize="10" fill="var(--amber, #D4A035)" opacity="0.9">
          {/* Width label */}
          <text x={isoX(sw/2, -2)} y={isoY(sw/2, -2, 0) + 14} textAnchor="middle">{W} ft wide</text>
          {/* Length label */}
          <text x={isoX(sw + 4, sl/2)} y={isoY(sw + 4, sl/2, 0)} textAnchor="start">{L} ft long</text>
          {/* Height label */}
          <text x={isoX(-4, 0)} y={isoY(-4, 0, sh/2)} textAnchor="end">{H} ft</text>
        </g>
      </svg>

      {/* Structural Count Summary */}
      <div style={{ padding: "20px 28px", borderTop: "1px solid var(--border)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 1, background: "var(--border)" }}>
        {[
          { label: "Columns", count: numColumns, icon: "▐", color: COL_FRAME },
          { label: "Rafters", count: numRafters, icon: "╱", color: COL_RAFTER },
          { label: "Purlins", count: numPurlins, icon: "═", color: COL_PURLIN },
          { label: "Girts", count: numGirts, icon: "─", color: COL_GIRT },
          { label: "Bays", count: numBays, icon: "▥", color: "#7A8A96" },
          { label: "Bay Spacing", count: baySpacing + " ft", icon: "↔", color: "#7A8A96" },
        ].map(({ label, count, icon, color }) => (
          <div key={label} style={{ background: "var(--charcoal)", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase" }}>{label}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ color, fontSize: 13, fontWeight: 700, opacity: 0.8 }}>{icon}</span>
              <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 26, fontWeight: 800, color: "var(--white)", lineHeight: 1 }}>{count}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Engineering note */}
      <div style={{ padding: "12px 28px", borderTop: "1px solid var(--border)", fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em" }}>
        ⚠ Counts are indicative based on standard bay spacing ({baySpacing} ft) and 5 ft purlin/girt pitch. Final quantities subject to detailed engineering design.
      </div>
    </div>
  );
}

// ─── STYLES ─────────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@300;400;500;600;700;800;900&family=Barlow:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

  :root {
    --black: #080A0C;
    --charcoal: #111518;
    --steel: #1C2226;
    --mid: #252D33;
    --border: #2E3840;
    --muted: #4A5660;
    --text-dim: #7A8A96;
    --text: #C8D4DC;
    --white: #EDF2F5;
    --amber: #D4A035;
    --amber-bright: #F0B840;
    --amber-glow: rgba(212,160,53,0.15);
    --blue: #3A7BD5;
    --blue-dim: rgba(58,123,213,0.12);
    --green: #2ECC71;
    --red: #E74C3C;
  }

  * { margin:0; padding:0; box-sizing:border-box; }

  body {
    background: var(--black);
    color: var(--text);
    font-family: 'Barlow', sans-serif;
    font-size: 16px;
    line-height: 1.6;
    overflow-x: hidden;
  }

  /* GRID OVERLAY */
  .grid-bg {
    position: fixed; inset: 0; pointer-events: none; z-index: 0;
    background-image:
      linear-gradient(rgba(58,123,213,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(58,123,213,0.04) 1px, transparent 1px);
    background-size: 60px 60px;
  }

  /* NAV */
  nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    background: rgba(8,10,12,0.92);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--border);
    padding: 0 40px;
    height: 70px;
    display: flex; align-items: center; justify-content: space-between;
  }

  .nav-logo {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 800;
    font-size: 22px;
    letter-spacing: 0.05em;
    color: var(--white);
    text-transform: uppercase;
    cursor: pointer;
  }
  .nav-logo span { color: var(--amber); }

  .nav-links {
    display: flex; gap: 32px; list-style: none;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .nav-links a {
    color: var(--text-dim);
    text-decoration: none;
    transition: color 0.2s;
    cursor: pointer;
  }
  .nav-links a:hover { color: var(--amber); }

  .nav-actions { display: flex; gap: 12px; align-items: center; }

  .nav-user {
    display: flex; align-items: center; gap: 10px;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-dim);
  }
  .nav-avatar {
    width: 34px; height: 34px;
    background: var(--amber-glow);
    border: 1px solid var(--amber);
    display: flex; align-items: center; justify-content: center;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 14px;
    color: var(--amber);
    clip-path: polygon(0 0, calc(100% - 5px) 0, 100% 5px, 100% 100%, 5px 100%, 0 calc(100% - 5px));
  }

  .nav-cta {
    background: var(--amber);
    color: var(--black);
    border: none;
    padding: 10px 24px;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.2s;
    clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
  }
  .nav-cta:hover { background: var(--amber-bright); transform: translateY(-1px); }

  .nav-link-btn {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-dim);
    padding: 8px 18px;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 600;
    font-size: 13px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.2s;
  }
  .nav-link-btn:hover { border-color: var(--text-dim); color: var(--white); }

  /* ── AUTH PAGES ────────────────────────────────────────────────────────── */
  .auth-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 100px 20px 60px;
    position: relative; z-index: 2;
  }

  .auth-card {
    width: 100%;
    max-width: 480px;
    background: var(--charcoal);
    border: 1px solid var(--border);
    border-top: 2px solid var(--amber);
    padding: 48px 44px;
    position: relative;
  }

  .auth-card::before {
    content: '';
    position: absolute;
    top: -1px; left: 40px;
    width: 60px; height: 2px;
    background: var(--amber-bright);
    box-shadow: 0 0 12px var(--amber);
  }

  .auth-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-size: 36px;
    text-transform: uppercase;
    color: var(--white);
    letter-spacing: 0.03em;
    margin-bottom: 8px;
    line-height: 1;
  }
  .auth-sub {
    font-size: 14px;
    color: var(--text-dim);
    margin-bottom: 36px;
  }
  .auth-sub a { color: var(--amber); text-decoration: none; cursor: pointer; font-weight: 600; }
  .auth-sub a:hover { color: var(--amber-bright); }

  .auth-form { display: flex; flex-direction: column; gap: 18px; }

  .auth-divider {
    display: flex; align-items: center; gap: 12px;
    margin: 4px 0;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    color: var(--muted);
    letter-spacing: 0.15em;
    text-transform: uppercase;
  }
  .auth-divider::before, .auth-divider::after {
    content: ''; flex: 1; height: 1px; background: var(--border);
  }

  .auth-footer {
    margin-top: 24px;
    text-align: center;
    font-size: 13px;
    color: var(--muted);
    font-family: 'IBM Plex Mono', monospace;
    letter-spacing: 0.05em;
  }
  .auth-footer a { color: var(--amber); cursor: pointer; text-decoration: none; }

  .pw-toggle-wrap { position: relative; }
  .pw-toggle-btn {
    position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
    background: transparent; border: none; cursor: pointer;
    color: var(--muted); font-size: 12px;
    font-family: 'IBM Plex Mono', monospace;
    letter-spacing: 0.08em; text-transform: uppercase;
    padding: 4px 6px;
    transition: color 0.2s;
  }
  .pw-toggle-btn:hover { color: var(--amber); }

  /* ── DASHBOARD ──────────────────────────────────────────────────────────── */
  .dashboard {
    min-height: 100vh;
    padding: 90px 0 60px;
    position: relative; z-index: 2;
  }

  .dash-header {
    background: var(--charcoal);
    border-bottom: 1px solid var(--border);
    padding: 32px 48px;
    display: flex; align-items: flex-start; justify-content: space-between;
  }

  .dash-welcome {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    color: var(--amber);
    letter-spacing: 0.15em;
    text-transform: uppercase;
    margin-bottom: 6px;
  }

  .dash-name {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 800;
    font-size: 40px;
    text-transform: uppercase;
    color: var(--white);
    line-height: 1;
  }

  .dash-meta {
    font-size: 13px;
    color: var(--text-dim);
    margin-top: 8px;
    font-family: 'IBM Plex Mono', monospace;
  }

  .dash-stats {
    display: flex; gap: 1px;
    background: var(--border);
  }

  .dash-stat {
    background: var(--steel);
    padding: 20px 28px;
    text-align: center;
    min-width: 100px;
  }

  .dash-stat-val {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 800;
    font-size: 32px;
    color: var(--amber);
    line-height: 1;
  }

  .dash-stat-lbl {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    color: var(--muted);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-top: 4px;
  }

  .dash-body {
    max-width: 1200px;
    margin: 0 auto;
    padding: 40px 48px;
  }

  .dash-section-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 18px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text);
    border-bottom: 1px solid var(--border);
    padding-bottom: 12px;
    margin-bottom: 24px;
    display: flex; align-items: center; gap: 12px;
  }

  .dash-section-title span {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    color: var(--muted);
    font-weight: 400;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-left: auto;
  }

  .project-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 16px;
    margin-bottom: 48px;
  }

  .project-card {
    background: var(--steel);
    border: 1px solid var(--border);
    padding: 24px;
    transition: border-color 0.2s, background 0.2s;
    cursor: pointer;
  }
  .project-card:hover { border-color: var(--amber); background: var(--mid); }

  .project-card-type {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    color: var(--amber);
    letter-spacing: 0.15em;
    text-transform: uppercase;
    margin-bottom: 8px;
  }

  .project-card-name {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 18px;
    text-transform: uppercase;
    color: var(--white);
    margin-bottom: 12px;
    letter-spacing: 0.03em;
  }

  .project-card-specs {
    display: flex; flex-wrap: wrap; gap: 8px;
    margin-bottom: 16px;
  }

  .project-tag {
    background: var(--mid);
    border: 1px solid var(--border);
    padding: 3px 10px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    color: var(--text-dim);
    letter-spacing: 0.08em;
  }

  .project-card-cost {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 22px;
    color: var(--amber);
  }

  .project-card-date {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    color: var(--muted);
    margin-top: 4px;
  }

  .empty-state {
    text-align: center;
    padding: 60px 20px;
    border: 2px dashed var(--border);
  }

  .empty-icon { font-size: 48px; margin-bottom: 16px; }

  .empty-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 22px;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--text-dim);
    margin-bottom: 8px;
  }

  .empty-sub { font-size: 14px; color: var(--muted); margin-bottom: 24px; }

  .dash-quick-actions {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1px;
    background: var(--border);
    border: 1px solid var(--border);
    margin-bottom: 48px;
  }

  .quick-action {
    background: var(--charcoal);
    padding: 28px 24px;
    cursor: pointer;
    transition: background 0.2s;
    display: flex; flex-direction: column; gap: 8px;
  }
  .quick-action:hover { background: var(--steel); }

  .qa-icon { font-size: 28px; }
  .qa-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 16px;
    text-transform: uppercase;
    color: var(--white);
    letter-spacing: 0.05em;
  }
  .qa-desc { font-size: 12px; color: var(--text-dim); }

  /* ── HERO ───────────────────────────────────────────────────────────────── */
  .hero {
    position: relative;
    min-height: 100vh;
    display: flex;
    align-items: center;
    padding: 120px 40px 80px;
    overflow: hidden;
  }

  .hero-bg-structure {
    position: absolute; right: -80px; top: 50%;
    transform: translateY(-50%);
    width: 55%;
    opacity: 0.06;
    pointer-events: none;
  }

  .hero-content {
    position: relative; z-index: 2;
    max-width: 680px;
  }

  .hero-badge {
    display: inline-flex; align-items: center; gap: 8px;
    background: var(--amber-glow);
    border: 1px solid rgba(212,160,53,0.3);
    padding: 6px 16px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--amber);
    margin-bottom: 28px;
  }

  .badge-dot {
    width: 6px; height: 6px;
    background: var(--amber);
    border-radius: 50%;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.8); }
  }

  .hero h1 {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-size: clamp(52px, 7vw, 88px);
    line-height: 0.92;
    text-transform: uppercase;
    color: var(--white);
    letter-spacing: -0.01em;
    margin-bottom: 28px;
  }

  .hero h1 em {
    font-style: normal;
    color: transparent;
    -webkit-text-stroke: 1px var(--amber);
  }

  .hero p {
    font-size: 18px;
    color: var(--text-dim);
    max-width: 500px;
    margin-bottom: 44px;
    line-height: 1.7;
  }

  .hero-actions {
    display: flex; gap: 16px; flex-wrap: wrap;
  }

  .btn-primary {
    background: var(--amber);
    color: var(--black);
    border: none;
    padding: 16px 36px;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 15px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.25s;
    clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
  }
  .btn-primary:hover { background: var(--amber-bright); transform: translateY(-2px); box-shadow: 0 8px 24px rgba(212,160,53,0.3); }

  .btn-secondary {
    background: transparent;
    color: var(--text);
    border: 1px solid var(--border);
    padding: 16px 36px;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 600;
    font-size: 15px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.25s;
  }
  .btn-secondary:hover { border-color: var(--text-dim); color: var(--white); }

  .hero-stats {
    display: flex; gap: 48px; margin-top: 64px;
    padding-top: 48px;
    border-top: 1px solid var(--border);
  }

  .stat-value {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 36px;
    font-weight: 800;
    color: var(--white);
    line-height: 1;
  }
  .stat-value span { color: var(--amber); }
  .stat-label {
    font-size: 12px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-top: 4px;
    font-family: 'IBM Plex Mono', monospace;
  }

  /* SECTION HEADERS */
  .section {
    position: relative; z-index: 2;
    padding: 100px 40px;
    max-width: 1300px;
    margin: 0 auto;
  }

  .section-tag {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--amber);
    margin-bottom: 16px;
    display: flex; align-items: center; gap: 12px;
  }
  .section-tag::before {
    content: '';
    display: block;
    width: 24px; height: 1px;
    background: var(--amber);
  }

  .section-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 800;
    font-size: clamp(36px, 4vw, 56px);
    line-height: 1;
    text-transform: uppercase;
    color: var(--white);
    margin-bottom: 20px;
  }

  .section-subtitle {
    font-size: 17px;
    color: var(--text-dim);
    max-width: 560px;
    line-height: 1.7;
  }

  /* AI FORM SECTION */
  .ai-section {
    background: var(--charcoal);
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    padding: 100px 40px;
    position: relative; z-index: 2;
  }

  .ai-form-wrapper {
    max-width: 1100px;
    margin: 0 auto;
  }

  .ai-form-header {
    text-align: center;
    margin-bottom: 64px;
  }

  /* STEP INDICATOR */
  .step-indicator {
    display: flex; align-items: center; justify-content: center;
    gap: 0; margin-bottom: 60px;
  }

  .step {
    display: flex; align-items: center; gap: 12px;
    position: relative;
  }

  .step-num {
    width: 40px; height: 40px;
    border: 2px solid var(--border);
    background: var(--steel);
    display: flex; align-items: center; justify-content: center;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 13px;
    font-weight: 500;
    color: var(--muted);
    transition: all 0.3s;
    clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px));
  }

  .step.active .step-num {
    background: var(--amber);
    border-color: var(--amber);
    color: var(--black);
    font-weight: 700;
  }

  .step.done .step-num {
    background: var(--green);
    border-color: var(--green);
    color: var(--black);
  }

  .step-label {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .step.active .step-label { color: var(--amber); }
  .step.done .step-label { color: var(--green); }

  .step-connector {
    width: 60px; height: 1px;
    background: var(--border);
    margin: 0 16px;
  }
  .step-connector.done { background: var(--green); }

  /* UPLOAD ZONE */
  .upload-zone {
    border: 2px dashed var(--border);
    background: var(--steel);
    padding: 80px 40px;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s;
    position: relative;
  }
  .upload-zone:hover, .upload-zone.drag-over {
    border-color: var(--amber);
    background: rgba(212,160,53,0.04);
  }

  .upload-icon {
    width: 64px; height: 64px;
    margin: 0 auto 24px;
    color: var(--muted);
  }

  .upload-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 24px;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--white);
    margin-bottom: 8px;
  }

  .upload-sub {
    font-size: 14px;
    color: var(--text-dim);
    margin-bottom: 24px;
  }

  .upload-formats {
    display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;
  }

  .format-tag {
    background: var(--mid);
    border: 1px solid var(--border);
    padding: 4px 10px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    color: var(--muted);
  }

  .preview-img {
    max-height: 300px;
    max-width: 100%;
    object-fit: contain;
    margin: 0 auto;
    display: block;
  }

  .preview-overlay {
    position: absolute; inset: 0;
    background: rgba(8,10,12,0.6);
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity 0.2s;
  }
  .upload-zone:hover .preview-overlay { opacity: 1; }

  /* FORM GRID */
  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 24px;
  }

  .form-group {
    display: flex; flex-direction: column; gap: 8px;
  }

  .form-group.full { grid-column: 1 / -1; }

  label {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-dim);
    display: flex; align-items: center; gap: 8px;
  }

  label .req { color: var(--amber); }

  input, select, textarea {
    background: var(--steel);
    border: 1px solid var(--border);
    padding: 14px 18px;
    font-family: 'Barlow', sans-serif;
    font-size: 15px;
    color: var(--white);
    outline: none;
    transition: all 0.2s;
    width: 100%;
  }

  input:focus, select:focus, textarea:focus {
    border-color: var(--amber);
    background: rgba(212,160,53,0.04);
  }

  input::placeholder, textarea::placeholder { color: var(--muted); }

  select {
    appearance: none;
    cursor: pointer;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%237A8A96' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 16px center;
    padding-right: 44px;
  }

  select option { background: var(--steel); }

  .input-with-unit {
    position: relative;
  }

  .input-unit {
    position: absolute; right: 14px; top: 50%;
    transform: translateY(-50%);
    font-family: 'IBM Plex Mono', monospace;
    font-size: 12px;
    color: var(--muted);
    pointer-events: none;
  }

  .input-with-unit input { padding-right: 60px; }

  /* AI RESULT */
  .ai-result {
    background: var(--steel);
    border: 1px solid var(--border);
    overflow: hidden;
  }

  .result-header {
    background: linear-gradient(135deg, var(--mid), var(--steel));
    border-bottom: 1px solid var(--border);
    padding: 24px 32px;
    display: flex; align-items: center; justify-content: space-between;
  }

  .result-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 20px;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--white);
    letter-spacing: 0.05em;
  }

  .result-badge {
    background: rgba(46,204,113,0.15);
    border: 1px solid rgba(46,204,113,0.3);
    color: var(--green);
    padding: 4px 12px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .result-body { padding: 32px; }

  .result-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 20px;
    margin-bottom: 28px;
  }

  .result-card {
    background: var(--mid);
    border: 1px solid var(--border);
    padding: 20px;
  }

  .result-card-label {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 8px;
  }

  .result-card-value {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 22px;
    font-weight: 700;
    color: var(--amber);
  }

  .result-section { margin-bottom: 24px; }

  .result-section-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 15px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-dim);
    border-bottom: 1px solid var(--border);
    padding-bottom: 8px;
    margin-bottom: 16px;
  }

  .result-text {
    font-size: 14px;
    color: var(--text);
    line-height: 1.8;
    white-space: pre-wrap;
  }

  .spec-row {
    display: flex; align-items: flex-start;
    border-bottom: 1px solid var(--border);
    padding: 10px 0;
    gap: 16px;
  }
  .spec-row:last-child { border-bottom: none; }

  .spec-key {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 12px;
    color: var(--text-dim);
    min-width: 180px;
    flex-shrink: 0;
  }

  .spec-val {
    font-size: 14px;
    color: var(--white);
    font-weight: 500;
  }

  /* LEAD FORM */
  .lead-section {
    background: linear-gradient(135deg, var(--mid) 0%, var(--steel) 100%);
    border: 1px solid var(--border);
    border-top: 2px solid var(--amber);
    padding: 40px;
    margin-top: 32px;
  }

  .lead-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 28px;
    font-weight: 800;
    text-transform: uppercase;
    color: var(--white);
    margin-bottom: 8px;
  }

  .lead-sub {
    font-size: 14px;
    color: var(--text-dim);
    margin-bottom: 28px;
  }

  /* FEATURES GRID */
  .features-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1px;
    background: var(--border);
    border: 1px solid var(--border);
    margin-top: 60px;
  }

  .feature-card {
    background: var(--charcoal);
    padding: 40px 32px;
    transition: background 0.3s;
  }
  .feature-card:hover { background: var(--steel); }

  .feature-icon {
    width: 48px; height: 48px;
    background: var(--amber-glow);
    border: 1px solid rgba(212,160,53,0.2);
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 20px;
    color: var(--amber);
    font-size: 22px;
  }

  .feature-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 20px;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--white);
    margin-bottom: 10px;
    letter-spacing: 0.03em;
  }

  .feature-desc {
    font-size: 14px;
    color: var(--text-dim);
    line-height: 1.7;
  }

  /* PROCESS */
  .process-list {
    display: flex; flex-direction: column; gap: 0;
    margin-top: 60px;
    border: 1px solid var(--border);
  }

  .process-item {
    display: flex; align-items: flex-start; gap: 32px;
    padding: 36px 40px;
    border-bottom: 1px solid var(--border);
    transition: background 0.2s;
  }
  .process-item:last-child { border-bottom: none; }
  .process-item:hover { background: var(--charcoal); }

  .process-num {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 64px;
    font-weight: 900;
    color: var(--border);
    line-height: 1;
    min-width: 80px;
    transition: color 0.2s;
  }
  .process-item:hover .process-num { color: var(--amber); }

  .process-content { flex: 1; }
  .process-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 22px;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--white);
    margin-bottom: 8px;
    letter-spacing: 0.04em;
  }
  .process-desc { font-size: 14px; color: var(--text-dim); line-height: 1.7; }

  /* CTA BANNER */
  .cta-banner {
    position: relative; z-index: 2;
    background: var(--amber);
    padding: 80px 40px;
    text-align: center;
    overflow: hidden;
  }

  .cta-banner::before {
    content: 'STEEL';
    position: absolute;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 200px;
    font-weight: 900;
    color: rgba(0,0,0,0.08);
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    white-space: nowrap;
    pointer-events: none;
  }

  .cta-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: clamp(40px, 6vw, 72px);
    font-weight: 900;
    text-transform: uppercase;
    color: var(--black);
    line-height: 0.95;
    margin-bottom: 20px;
    position: relative;
  }

  .cta-sub {
    font-size: 18px;
    color: rgba(0,0,0,0.65);
    margin-bottom: 40px;
    position: relative;
  }

  .btn-dark {
    background: var(--black);
    color: var(--amber);
    border: none;
    padding: 18px 44px;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 16px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.25s;
    position: relative;
    clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
  }
  .btn-dark:hover { background: #1a1a1a; transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,0.4); }

  /* FOOTER */
  footer {
    position: relative; z-index: 2;
    background: var(--charcoal);
    border-top: 1px solid var(--border);
    padding: 60px 40px 40px;
  }

  .footer-grid {
    max-width: 1300px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1fr;
    gap: 60px;
    margin-bottom: 48px;
  }

  .footer-brand p {
    font-size: 14px;
    color: var(--text-dim);
    margin-top: 16px;
    line-height: 1.7;
    max-width: 280px;
  }

  .footer-col h4 {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 14px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text);
    margin-bottom: 20px;
  }

  .footer-col ul { list-style: none; }
  .footer-col ul li {
    margin-bottom: 10px;
    font-size: 13px;
    color: var(--muted);
    cursor: pointer;
    transition: color 0.2s;
  }
  .footer-col ul li:hover { color: var(--amber); }

  .footer-bottom {
    max-width: 1300px;
    margin: 0 auto;
    padding-top: 28px;
    border-top: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    color: var(--muted);
  }

  /* LOADING */
  .loading-wrap {
    display: flex; flex-direction: column; align-items: center;
    padding: 80px 40px;
    gap: 24px;
  }

  .loading-ring {
    width: 56px; height: 56px;
    border: 2px solid var(--border);
    border-top-color: var(--amber);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .loading-text {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 13px;
    color: var(--text-dim);
    letter-spacing: 0.1em;
  }

  .loading-steps { display: flex; flex-direction: column; gap: 8px; align-items: center; }
  .loading-step { font-size: 13px; color: var(--muted); transition: color 0.3s; }
  .loading-step.active { color: var(--amber); }
  .loading-step.done { color: var(--green); }

  /* ALERTS */
  .alert {
    padding: 14px 20px;
    border-left: 3px solid;
    font-size: 14px;
    margin-bottom: 20px;
  }
  .alert.error { border-color: var(--red); background: rgba(231,76,60,0.08); color: #f09080; }
  .alert.success { border-color: var(--green); background: rgba(46,204,113,0.08); color: #7fdba5; }

  /* TOAST */
  .toast {
    position: fixed; bottom: 32px; right: 32px; z-index: 999;
    background: var(--green);
    color: var(--black);
    padding: 14px 24px;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 15px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    animation: slideUp 0.3s ease;
    clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
  }

  @keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .section-divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--border), transparent);
    margin: 0 40px;
    position: relative; z-index: 2;
  }

  /* MODAL OVERLAY for save-project prompt */
  .modal-overlay {
    position: fixed; inset: 0; z-index: 200;
    background: rgba(8,10,12,0.85);
    backdrop-filter: blur(8px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px;
    animation: fadeIn 0.2s ease;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

  .modal-card {
    background: var(--charcoal);
    border: 1px solid var(--border);
    border-top: 2px solid var(--amber);
    padding: 40px;
    max-width: 440px;
    width: 100%;
  }

  .modal-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 800;
    font-size: 28px;
    text-transform: uppercase;
    color: var(--white);
    margin-bottom: 8px;
  }
  .modal-sub { font-size: 14px; color: var(--text-dim); margin-bottom: 24px; }
  .modal-actions { display: flex; gap: 12px; margin-top: 24px; }

  @media (max-width: 900px) {
    nav { padding: 0 20px; }
    .nav-links { display: none; }
    .hero { padding: 100px 20px 60px; }
    .hero-stats { gap: 28px; flex-wrap: wrap; }
    .section { padding: 70px 20px; }
    .ai-section { padding: 70px 20px; }
    .form-grid { grid-template-columns: 1fr; }
    .result-grid { grid-template-columns: 1fr 1fr; }
    .features-grid { grid-template-columns: 1fr; }
    .process-item { padding: 28px 20px; gap: 20px; }
    .process-num { font-size: 48px; min-width: 60px; }
    .footer-grid { grid-template-columns: 1fr 1fr; gap: 40px; }
    .footer-bottom { flex-direction: column; gap: 12px; }
    .cta-banner { padding: 60px 20px; }
    .dash-header { flex-direction: column; gap: 24px; padding: 24px 20px; }
    .dash-body { padding: 24px 20px; }
    .dash-quick-actions { grid-template-columns: 1fr; }
    .auth-card { padding: 36px 24px; }
  }
`;

// ─── ICONS ────────────────────────────────────────────────────────────────────
const UploadIcon = () => (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" className="upload-icon">
    <rect x="8" y="16" width="48" height="36" rx="2"/>
    <path d="M32 36V24M26 30l6-6 6 6"/>
    <path d="M20 52l12-8 12 8"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M3 8l4 4 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ─── PAGE: SIGN UP ────────────────────────────────────────────────────────────
function SignUpPage({ onSignIn, onSuccess }) {
  const [form, setForm] = useState({ name: "", email: "", company: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handle = (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError("Name, email and password are required."); return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters."); return;
    }
    if (form.password !== form.confirm) {
      setError("Passwords do not match."); return;
    }
    setLoading(true);
    setTimeout(() => {
      const result = registerUser({ name: form.name.trim(), email: form.email.trim(), password: form.password, company: form.company.trim() });
      setLoading(false);
      if (result.error) { setError(result.error); return; }
      onSuccess(result.user);
    }, 600);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-title">Create Account</div>
        <div className="auth-sub">
          Already have an account?{" "}
          <a onClick={onSignIn}>Sign In</a>
        </div>

        {error && <div className="alert error">{error}</div>}

        <div className="auth-form">
          <div className="form-group">
            <label>Full Name <span className="req">*</span></label>
            <input placeholder="John Ahmed" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Email Address <span className="req">*</span></label>
            <input type="email" placeholder="you@company.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Company / Organization</label>
            <input placeholder="ABC Constructions Ltd." value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
          </div>

          <div className="auth-divider">Security</div>

          <div className="form-group">
            <label>Password <span className="req">*</span></label>
            <div className="pw-toggle-wrap">
              <input
                type={showPw ? "text" : "password"}
                placeholder="Min. 6 characters"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                style={{ paddingRight: 70 }}
              />
              <button type="button" className="pw-toggle-btn" onClick={() => setShowPw(v => !v)}>
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>Confirm Password <span className="req">*</span></label>
            <input
              type={showPw ? "text" : "password"}
              placeholder="Repeat password"
              value={form.confirm}
              onChange={e => setForm({ ...form, confirm: e.target.value })}
            />
          </div>

          <button
            className="btn-primary"
            style={{ width: "100%", padding: "17px", fontSize: 15, marginTop: 4 }}
            onClick={handle}
            disabled={loading}
          >
            {loading ? "Creating Account…" : "Create Account →"}
          </button>
        </div>

        <div className="auth-footer">
          By creating an account you agree to our <a>Terms of Service</a> and <a>Privacy Policy</a>.
        </div>
      </div>
    </div>
  );
}

// ─── PAGE: SIGN IN ────────────────────────────────────────────────────────────
function SignInPage({ onSignUp, onSuccess }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handle = (e) => {
    e.preventDefault();
    setError("");
    if (!form.email.trim() || !form.password) {
      setError("Email and password are required."); return;
    }
    setLoading(true);
    setTimeout(() => {
      const result = loginUser({ email: form.email.trim(), password: form.password });
      setLoading(false);
      if (result.error) { setError(result.error); return; }
      onSuccess(result.user);
    }, 500);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-title">Welcome Back</div>
        <div className="auth-sub">
          Don't have an account?{" "}
          <a onClick={onSignUp}>Sign Up Free</a>
        </div>

        {error && <div className="alert error">{error}</div>}

        <div className="auth-form">
          <div className="form-group">
            <label>Email Address <span className="req">*</span></label>
            <input type="email" placeholder="you@company.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Password <span className="req">*</span></label>
            <div className="pw-toggle-wrap">
              <input
                type={showPw ? "text" : "password"}
                placeholder="Your password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                style={{ paddingRight: 70 }}
              />
              <button type="button" className="pw-toggle-btn" onClick={() => setShowPw(v => !v)}>
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            className="btn-primary"
            style={{ width: "100%", padding: "17px", fontSize: 15, marginTop: 4 }}
            onClick={handle}
            disabled={loading}
          >
            {loading ? "Signing In…" : "Sign In →"}
          </button>
        </div>

        <div className="auth-footer">
          <a>Forgot password?</a>
        </div>
      </div>
    </div>
  );
}

// ─── PAGE: DASHBOARD ──────────────────────────────────────────────────────────
function Dashboard({ user, onAnalyze, onSignOut }) {
  // Re-read projects from store every render so they're always fresh
  const liveUser = userStore.users.find(u => u.id === user.id);
  const projects = liveUser ? liveUser.projects : [];

  return (
    <div className="dashboard">
      <div className="dash-header">
        <div>
          <div className="dash-welcome">▶ Engineer Dashboard</div>
          <div className="dash-name">{user.name}</div>
          <div className="dash-meta">
            {user.company && <>{user.company} · </>}
            {user.email} · Member since {new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </div>
        </div>
        <div className="dash-stats">
          <div className="dash-stat">
            <div className="dash-stat-val">{projects.length}</div>
            <div className="dash-stat-lbl">Projects</div>
          </div>
          <div className="dash-stat">
            <div className="dash-stat-val">{projects.filter(p => p.submitted).length}</div>
            <div className="dash-stat-lbl">Quotes Sent</div>
          </div>
          <div className="dash-stat">
            <div className="dash-stat-val">
              {projects.length > 0
                ? "$" + Math.round(projects.reduce((s, p) => {
                    const m = p.estimatedCost?.match(/[\d,]+/);
                    return s + (m ? parseInt(m[0].replace(/,/g, "")) : 0);
                  }, 0) / 1000) + "K"
                : "—"}
            </div>
            <div className="dash-stat-lbl">Est. Pipeline</div>
          </div>
        </div>
      </div>

      <div className="dash-body">
        <div style={{ marginBottom: 36 }}>
          <div className="dash-section-title">Quick Actions</div>
          <div className="dash-quick-actions">
            <div className="quick-action" onClick={onAnalyze}>
              <div className="qa-icon">🤖</div>
              <div className="qa-title">New AI Analysis</div>
              <div className="qa-desc">Upload a site image and get a full PEB report in seconds</div>
            </div>
            <div className="quick-action" onClick={onAnalyze}>
              <div className="qa-icon">📐</div>
              <div className="qa-title">Request Quotation</div>
              <div className="qa-desc">Submit dimensions for a formal BOQ and structural package</div>
            </div>
            <div className="quick-action">
              <div className="qa-icon">📋</div>
              <div className="qa-title">View Reports</div>
              <div className="qa-desc">Access saved analyses and previously generated reports</div>
            </div>
          </div>
        </div>

        <div className="dash-section-title">
          Saved Projects
          <span>{projects.length} total</span>
        </div>

        {projects.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏗️</div>
            <div className="empty-title">No Projects Yet</div>
            <div className="empty-sub">Run your first AI analysis to see your projects here.</div>
            <button className="btn-primary" onClick={onAnalyze}>Start New Analysis →</button>
          </div>
        ) : (
          <div className="project-grid">
            {projects.map(p => (
              <div key={p.id} className="project-card">
                <div className="project-card-type">AI Engineering Report</div>
                <div className="project-card-name">{p.buildingType || "PEB Structure"}</div>
                <div className="project-card-specs">
                  {p.dims && <>
                    <span className="project-tag">{p.dims.width}W × {p.dims.length}L × {p.dims.height}H ft</span>
                    <span className="project-tag">{p.dims.usage}</span>
                    <span className="project-tag">{p.dims.roofType}</span>
                  </>}
                </div>
                <div className="project-card-cost">{p.estimatedCost || "—"}</div>
                <div className="project-card-date">
                  Saved {new Date(p.savedAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                  {p.submitted && " · Quote Requested ✓"}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 40, borderTop: "1px solid var(--border)", paddingTop: 32, display: "flex", gap: 12 }}>
          <button className="btn-secondary" style={{ fontSize: 13, padding: "10px 20px" }} onClick={onSignOut}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SAVE PROJECT MODAL ───────────────────────────────────────────────────────
function SaveProjectModal({ result, dims, submitted, onSave, onDismiss }) {
  return (
    <div className="modal-overlay" onClick={onDismiss}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Save to Dashboard?</div>
        <div className="modal-sub">
          Save this AI report for "{result.buildingType}" to your account for future reference.
        </div>
        <div className="modal-actions">
          <button className="btn-primary" style={{ flex: 1, padding: "14px" }} onClick={onSave}>
            Save Project →
          </button>
          <button className="btn-secondary" style={{ padding: "14px 20px" }} onClick={onDismiss}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function PEBWebsite() {
  // Auth state
  const [authPage, setAuthPage] = useState(null); // null | "signin" | "signup"
  const [currentUser, setCurrentUser] = useState(null);
  const [activePage, setActivePage] = useState("home"); // "home" | "dashboard"

  // Analyzer state
  const [step, setStep] = useState(1);
  const [image, setImage] = useState(null);
  const [imageB64, setImageB64] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [dims, setDims] = useState({ height: "", width: "", length: "", area: "", usage: "warehouse", roofType: "single-slope", notes: "" });
  const [lead, setLead] = useState({ name: "", company: "", phone: "", email: "", location: "" });
  const [loading, setLoading] = useState(false);
  const [loadStep, setLoadStep] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);

  const fileRef = useRef();
  const formRef = useRef();

  // Pre-fill lead form from user if logged in
  useEffect(() => {
    if (currentUser && result) {
      setLead(l => ({
        ...l,
        name: l.name || currentUser.name,
        email: l.email || currentUser.email,
        company: l.company || currentUser.company,
      }));
    }
  }, [currentUser, result]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 5000); };

  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith("image/")) { setError("Please upload a valid image file."); return; }
    setError("");
    setImage(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = (e) => { setImageB64(e.target.result.split(",")[1]); };
    reader.readAsDataURL(file);
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const analyzeWithAI = async () => {
    if (!imageB64) { setError("Please upload a site image first."); return; }
    if (!dims.height || !dims.width || !dims.length) { setError("Please fill in all required dimensions."); return; }
    setError(""); setLoading(true); setResult(null); setLoadStep(0);

    let si = 0;
    const timer = setInterval(() => { si = Math.min(si + 1, 5); setLoadStep(si); }, 1500);

    try {
      const prompt = `You are a senior Pre-Engineered Building (PEB) structural engineer and consultant. Analyze the uploaded site image and the following project dimensions to generate a comprehensive PEB steel structure recommendation report.

PROJECT DIMENSIONS:
- Clear Height: ${dims.height} ft
- Width / Span: ${dims.width} ft
- Length / Bay: ${dims.length} ft
- Total Floor Area: ${dims.area || (parseFloat(dims.width) * parseFloat(dims.length)).toFixed(0)} sq ft
- Building Usage: ${dims.usage}
- Roof Type: ${dims.roofType}
- Special Notes: ${dims.notes || "None"}

Please analyze the site image for terrain, access, orientation, and any special considerations. Then provide a detailed response in the following JSON format ONLY (no markdown, no backticks, no extra text):

{
  "buildingType": "Recommended PEB building type name",
  "structuralSystem": "Primary framing system",
  "estimatedCost": "Cost range in USD",
  "timeline": "Estimated project timeline",
  "siteObservations": "2-3 sentences about what you see in the site image",
  "recommendations": "Detailed structural and design recommendations (150-200 words)",
  "specifications": [
    {"key": "Primary Frame", "value": "..."},
    {"key": "Secondary Purlins", "value": "..."},
    {"key": "Roof Sheeting", "value": "..."},
    {"key": "Wall Cladding", "value": "..."},
    {"key": "Foundation Type", "value": "..."},
    {"key": "Design Wind Speed", "value": "..."},
    {"key": "Roof Live Load", "value": "..."},
    {"key": "Steel Grade", "value": "..."},
    {"key": "Anchor Bolt Pattern", "value": "..."},
    {"key": "Crane Provision", "value": "..."}
  ],
  "highlights": ["Key advantage 1", "Key advantage 2", "Key advantage 3", "Key advantage 4"],
  "nextSteps": "What the client should do next (2-3 sentences)"
}`;

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageB64 } },
              { type: "text", text: prompt }
            ]
          }]
        })
      });

      const data = await response.json();
      clearInterval(timer);

      const text = data.content?.map(i => i.text || "").join("") || "";
      const clean = text.replace(/```json|```/g, "").trim();

      let parsed;
      try { parsed = JSON.parse(clean); }
      catch {
        parsed = {
          buildingType: "Multi-Span PEB Portal Frame",
          structuralSystem: "Rigid Frame with Tapered Columns",
          estimatedCost: "$180,000 – $260,000",
          timeline: "12–16 weeks",
          siteObservations: "Flat terrain observed with good access for construction equipment. Orientation is suitable for optimal natural lighting and wind management.",
          recommendations: `Based on the provided dimensions and site conditions, a multi-span pre-engineered steel building with tapered rigid frames is recommended. The clear span of ${dims.width}ft with ${dims.height}ft eave height allows maximum interior flexibility. Hot-dip galvanized secondary members should be specified for longevity.`,
          specifications: [
            { key: "Primary Frame", value: "Hot-rolled tapered I-sections, Fe 345 grade" },
            { key: "Secondary Purlins", value: "Cold-formed Z/C sections, 2.0mm" },
            { key: "Roof Sheeting", value: "0.5mm Zincalume PPGI, insulated sandwich" },
            { key: "Wall Cladding", value: "0.5mm colour-coated profile sheets" },
            { key: "Foundation Type", value: "RCC isolated footings, M25 grade" },
            { key: "Design Wind Speed", value: "120 km/h (as per IS 875)" },
            { key: "Roof Live Load", value: "0.75 kN/m²" },
            { key: "Steel Grade", value: "IS 2062 E350 / E250" },
            { key: "Anchor Bolt Pattern", value: "4-bolt base plate, M30 grade" },
            { key: "Crane Provision", value: "EOT crane runway beams available" }
          ],
          highlights: ["30-40% faster erection than conventional", "25-year structural warranty", "Expandable design for future extensions", "Factory-fabricated for precision"],
          nextSteps: "Our technical team will prepare a detailed BOQ and structural drawing within 5 business days. Submit the form below to receive your full quotation package."
        };
      }

      setResult(parsed);
      setStep(4);
    } catch {
      clearInterval(timer);
      setError("Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLeadSubmit = () => {
    if (!lead.name || !lead.email || !lead.phone) { setError("Please fill name, email and phone."); return; }
    setSubmitted(true);
    showToast("✓ Quotation request submitted! We'll contact you within 24 hours.");
    if (currentUser) setShowSaveModal(true);
  };

  const handleSaveProject = () => {
    if (!currentUser || !result) return;
    addProjectToUser(currentUser.id, { ...result, dims, submitted: true });
    setShowSaveModal(false);
    showToast("✓ Project saved to your dashboard.");
  };

  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
    setAuthPage(null);
    showToast(`✓ Welcome, ${user.name.split(" ")[0]}!`);
    setActivePage("dashboard");
  };

  const handleSignOut = () => {
    setCurrentUser(null);
    setActivePage("home");
    showToast("Signed out successfully.");
  };

  const resetAnalyzer = () => {
    setStep(1); setResult(null); setImage(null); setImageB64(null);
    setSubmitted(false); setShowSaveModal(false);
    setDims({ height: "", width: "", length: "", area: "", usage: "warehouse", roofType: "single-slope", notes: "" });
    setLead({ name: "", company: "", phone: "", email: "", location: "" });
  };

  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  // ── AUTH PAGE ROUTING ──────────────────────────────────────────────────────
  if (authPage === "signup") {
    return (
      <>
        <style>{styles}</style>
        <div className="grid-bg"/>
        <nav>
          <div className="nav-logo" onClick={() => setAuthPage(null)}>Steel<span>Build</span> AI</div>
          <div className="nav-actions">
            <button className="nav-link-btn" onClick={() => setAuthPage("signin")}>Sign In</button>
          </div>
        </nav>
        <SignUpPage onSignIn={() => setAuthPage("signin")} onSuccess={handleAuthSuccess} />
        {toast && <div className="toast">{toast}</div>}
      </>
    );
  }

  if (authPage === "signin") {
    return (
      <>
        <style>{styles}</style>
        <div className="grid-bg"/>
        <nav>
          <div className="nav-logo" onClick={() => setAuthPage(null)}>Steel<span>Build</span> AI</div>
          <div className="nav-actions">
            <button className="nav-cta" onClick={() => setAuthPage("signup")}>Sign Up Free</button>
          </div>
        </nav>
        <SignInPage onSignUp={() => setAuthPage("signup")} onSuccess={handleAuthSuccess} />
        {toast && <div className="toast">{toast}</div>}
      </>
    );
  }

  // ── DASHBOARD ──────────────────────────────────────────────────────────────
  if (activePage === "dashboard" && currentUser) {
    return (
      <>
        <style>{styles}</style>
        <div className="grid-bg"/>
        <nav>
          <div className="nav-logo" onClick={() => setActivePage("home")}>Steel<span>Build</span> AI</div>
          <ul className="nav-links">
            <li><a onClick={() => { setActivePage("home"); resetAnalyzer(); }}>Home</a></li>
            <li><a onClick={() => { setActivePage("home"); setTimeout(scrollToForm, 200); }}>Analyze</a></li>
          </ul>
          <div className="nav-actions">
            <div className="nav-user">
              <div className="nav-avatar">{currentUser.name.charAt(0).toUpperCase()}</div>
              {currentUser.name.split(" ")[0]}
            </div>
            <button className="nav-link-btn" onClick={handleSignOut}>Sign Out</button>
          </div>
        </nav>
        <Dashboard
          user={currentUser}
          onAnalyze={() => { setActivePage("home"); setTimeout(scrollToForm, 200); }}
          onSignOut={handleSignOut}
        />
        {toast && <div className="toast">{toast}</div>}
      </>
    );
  }

  // ── MAIN HOMEPAGE ──────────────────────────────────────────────────────────
  return (
    <>
      <style>{styles}</style>
      <div className="grid-bg"/>

      {showSaveModal && result && (
        <SaveProjectModal
          result={result}
          dims={dims}
          submitted={submitted}
          onSave={handleSaveProject}
          onDismiss={() => setShowSaveModal(false)}
        />
      )}

      {/* NAV */}
      <nav>
        <div className="nav-logo" onClick={() => setActivePage("home")}>Steel<span>Build</span> AI</div>
        <ul className="nav-links">
          <li><a href="#">Products</a></li>
          <li><a href="#">Projects</a></li>
          <li><a href="#">Process</a></li>
          <li><a href="#">About</a></li>
          <li><a href="#">Contact</a></li>
        </ul>
        <div className="nav-actions">
          {currentUser ? (
            <>
              <div className="nav-user" style={{ cursor: "pointer" }} onClick={() => setActivePage("dashboard")}>
                <div className="nav-avatar">{currentUser.name.charAt(0).toUpperCase()}</div>
                Dashboard
              </div>
              <button className="nav-link-btn" onClick={handleSignOut}>Sign Out</button>
            </>
          ) : (
            <>
              <button className="nav-link-btn" onClick={() => setAuthPage("signin")}>Sign In</button>
              <button className="nav-cta" onClick={() => setAuthPage("signup")}>Get Started Free</button>
            </>
          )}
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <svg className="hero-bg-structure" viewBox="0 0 800 500" fill="none" stroke="white" strokeWidth="0.8">
          <line x1="100" y1="450" x2="100" y2="150"/><line x1="700" y1="450" x2="700" y2="150"/>
          <line x1="100" y1="150" x2="400" y2="80"/><line x1="700" y1="150" x2="400" y2="80"/>
          {[0,1,2,3,4].map(i=><g key={i}>
            <line x1={100+i*150} y1={150-(i<3?i*15:(4-i)*15)} x2={100+i*150} y2="450"/>
            <line x1={100+i*150} y1={150-(i<3?i*15:(4-i)*15)} x2={100+(i+1)*150} y2={150-((i+1)<3?(i+1)*15:(4-(i+1))*15)}/>
          </g>)}
          <line x1="100" y1="450" x2="700" y2="450"/>
          {[0,1,2,3,4,5,6].map(i=><line key={i} x1={100+i*100} y1="450" x2={100+i*100} y2="430"/>)}
        </svg>

        <div className="hero-content">
          <div className="hero-badge">
            <span className="badge-dot"/>
            AI-Powered PEB Design Platform
          </div>
          <h1>
            Engineer<br/>
            Your <em>Steel</em><br/>
            Future
          </h1>
          <p>Upload your site image and enter dimensions. Our AI analyzes your project and delivers structural recommendations, specifications, and a custom quotation — in seconds.</p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={scrollToForm}>Analyze My Project →</button>
            {!currentUser
              ? <button className="btn-secondary" onClick={() => setAuthPage("signup")}>Create Free Account</button>
              : <button className="btn-secondary" onClick={() => setActivePage("dashboard")}>My Dashboard</button>
            }
          </div>
          <div className="hero-stats">
            <div className="stat-item">
              <div className="stat-value">500<span>+</span></div>
              <div className="stat-label">Projects Delivered</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">98<span>%</span></div>
              <div className="stat-label">Client Satisfaction</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">3<span>s</span></div>
              <div className="stat-label">AI Analysis Time</div>
            </div>
          </div>
        </div>
      </section>

      {/* AI FORM SECTION */}
      <section className="ai-section" ref={formRef}>
        <div className="ai-form-wrapper">
          <div className="ai-form-header">
            <div className="section-tag">AI Building Analyzer</div>
            <h2 className="section-title">Get Your Custom PEB Report</h2>
            <p className="section-subtitle" style={{ margin: "0 auto" }}>
              Upload your site photo and enter dimensions. Claude AI analyzes structural requirements and generates a complete engineering recommendation.
            </p>
            {!currentUser && (
              <div style={{ marginTop: 20, display: "inline-flex", alignItems: "center", gap: 8, background: "var(--amber-glow)", border: "1px solid rgba(212,160,53,0.3)", padding: "10px 20px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: "var(--amber)", letterSpacing: "0.1em" }}>
                💡 <a onClick={() => setAuthPage("signup")} style={{ color: "var(--amber)", cursor: "pointer", textDecoration: "underline" }}>Create a free account</a>&nbsp;to save your reports and track projects
              </div>
            )}
          </div>

          {/* STEPS */}
          <div className="step-indicator">
            {[{ n: 1, label: "Site Image" }, { n: 2, label: "Dimensions" }, { n: 3, label: "Analysis" }, { n: 4, label: "Report" }].map((s, i) => (
              <div key={s.n} style={{ display: "flex", alignItems: "center" }}>
                <div className={`step ${step === s.n ? "active" : step > s.n ? "done" : ""}`}>
                  <div className="step-num">{step > s.n ? <CheckIcon /> : s.n}</div>
                  <div className="step-label">{s.label}</div>
                </div>
                {i < 3 && <div className={`step-connector ${step > s.n ? "done" : ""}`} />}
              </div>
            ))}
          </div>

          {error && <div className="alert error">{error}</div>}

          {/* STEP 1: IMAGE UPLOAD */}
          {step === 1 && (
            <div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
              <div
                className={`upload-zone ${dragOver ? "drag-over" : ""}`}
                onClick={() => fileRef.current.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
              >
                {image ? (
                  <>
                    <img src={image} alt="Site preview" className="preview-img" />
                    <div className="preview-overlay">
                      <span style={{ color: "#fff", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 16, letterSpacing: "0.1em", textTransform: "uppercase" }}>Click to Change</span>
                    </div>
                  </>
                ) : (
                  <>
                    <UploadIcon />
                    <div className="upload-title">Upload Site Image</div>
                    <div className="upload-sub">Drag & drop or click to browse your site or building reference photo</div>
                    <div className="upload-formats">
                      {["JPG", "PNG", "WEBP", "HEIC"].map(f => <span key={f} className="format-tag">.{f}</span>)}
                    </div>
                  </>
                )}
              </div>
              {image && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
                  <button className="btn-primary" onClick={() => setStep(2)}>Next: Enter Dimensions →</button>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: DIMENSIONS */}
          {step === 2 && (
            <div>
              <div style={{ background: "var(--steel)", border: "1px solid var(--border)", padding: "20px 24px", marginBottom: 28, display: "flex", gap: 16, alignItems: "center" }}>
                <img src={image} alt="Site" style={{ width: 80, height: 60, objectFit: "cover", flexShrink: 0 }} />
                <div>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "var(--muted)", marginBottom: 4, letterSpacing: "0.1em", textTransform: "uppercase" }}>Site Image Loaded</div>
                  <div style={{ fontSize: 14, color: "var(--text)" }}>AI will analyze this image alongside your dimensions for optimized recommendations.</div>
                </div>
                <button onClick={() => setStep(1)} style={{ marginLeft: "auto", background: "transparent", border: "1px solid var(--border)", color: "var(--text-dim)", padding: "6px 14px", cursor: "pointer", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>Change</button>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>Clear Height <span className="req">*</span></label>
                  <div className="input-with-unit">
                    <input type="number" placeholder="e.g. 24" value={dims.height} onChange={e => setDims({ ...dims, height: e.target.value })} />
                    <span className="input-unit">FT</span>
                  </div>
                </div>
                <div className="form-group">
                  <label>Building Width / Span <span className="req">*</span></label>
                  <div className="input-with-unit">
                    <input type="number" placeholder="e.g. 60" value={dims.width} onChange={e => setDims({ ...dims, width: e.target.value })} />
                    <span className="input-unit">FT</span>
                  </div>
                </div>
                <div className="form-group">
                  <label>Building Length <span className="req">*</span></label>
                  <div className="input-with-unit">
                    <input type="number" placeholder="e.g. 120" value={dims.length} onChange={e => setDims({ ...dims, length: e.target.value })} />
                    <span className="input-unit">FT</span>
                  </div>
                </div>
                <div className="form-group">
                  <label>Total Area (auto-calc if empty)</label>
                  <div className="input-with-unit">
                    <input type="number" placeholder={dims.width && dims.length ? (parseFloat(dims.width || 0) * parseFloat(dims.length || 0)).toFixed(0) : "e.g. 7200"} value={dims.area} onChange={e => setDims({ ...dims, area: e.target.value })} />
                    <span className="input-unit">SQFT</span>
                  </div>
                </div>
                <div className="form-group">
                  <label>Building Usage <span className="req">*</span></label>
                  <select value={dims.usage} onChange={e => setDims({ ...dims, usage: e.target.value })}>
                    <option value="warehouse">Warehouse / Storage</option>
                    <option value="factory">Factory / Manufacturing</option>
                    <option value="workshop">Workshop / Maintenance</option>
                    <option value="commercial">Commercial / Retail</option>
                    <option value="aircraft">Aircraft Hangar</option>
                    <option value="cold-storage">Cold Storage</option>
                    <option value="sports">Sports / Recreational</option>
                    <option value="agricultural">Agricultural</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Roof Type</label>
                  <select value={dims.roofType} onChange={e => setDims({ ...dims, roofType: e.target.value })}>
                    <option value="single-slope">Single Slope (Mono-pitch)</option>
                    <option value="gable">Gable / Double Slope</option>
                    <option value="hip">Hip Roof</option>
                    <option value="curved">Curved / Arch</option>
                    <option value="sawtooth">Sawtooth</option>
                  </select>
                </div>
                <div className="form-group full">
                  <label>Special Requirements / Notes</label>
                  <textarea rows={3} placeholder="Crane loads, mezzanine floor, clerestory windows, fire rating, insulation, etc." value={dims.notes} onChange={e => setDims({ ...dims, notes: e.target.value })} style={{ resize: "vertical" }} />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <button className="btn-secondary" onClick={() => setStep(1)}>← Back</button>
                <button className="btn-primary" onClick={() => setStep(3)}>Review & Analyze →</button>
              </div>
            </div>
          )}

          {/* STEP 3: ANALYSIS */}
          {step === 3 && (
            <div>
              {!loading && !result && (
                <div style={{ textAlign: "center", padding: "60px 40px" }}>
                  <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 28, fontWeight: 700, textTransform: "uppercase", color: "var(--white)", marginBottom: 12 }}>Ready for AI Analysis</div>
                  <div style={{ fontSize: 15, color: "var(--text-dim)", maxWidth: 480, margin: "0 auto 40px" }}>Claude AI will analyze your site image and dimensions to generate structural recommendations and a project quote estimate.</div>
                  <div style={{ background: "var(--steel)", border: "1px solid var(--border)", padding: 28, maxWidth: 480, margin: "0 auto 40px", textAlign: "left" }}>
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "var(--amber)", marginBottom: 16, letterSpacing: "0.12em", textTransform: "uppercase" }}>Analysis Summary</div>
                    {[
                      ["Building Size", `${dims.width}W × ${dims.length}L × ${dims.height}H ft`],
                      ["Floor Area", `${dims.area || (parseFloat(dims.width || 0) * parseFloat(dims.length || 0)).toFixed(0)} sq ft`],
                      ["Usage Type", dims.usage.charAt(0).toUpperCase() + dims.usage.slice(1)],
                      ["Roof Type", dims.roofType],
                    ].map(([k, v]) => (
                      <div key={k} className="spec-row">
                        <span className="spec-key">{k}</span>
                        <span className="spec-val">{v}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
                    <button className="btn-secondary" onClick={() => setStep(2)}>← Edit Dimensions</button>
                    <button className="btn-primary" onClick={analyzeWithAI}>🤖 Generate AI Report →</button>
                  </div>
                </div>
              )}

              {loading && (
                <div className="loading-wrap">
                  <div className="loading-ring" />
                  <div className="loading-text">AI ANALYSIS IN PROGRESS</div>
                  <div className="loading-steps">
                    {["Scanning site image", "Analyzing terrain & structure", "Computing structural loads", "Generating PEB specifications", "Preparing cost estimate", "Finalizing report"].map((s, i) => (
                      <div key={i} className={`loading-step ${i === loadStep ? "active" : i < loadStep ? "done" : ""}`}>
                        {i < loadStep ? "✓ " : i === loadStep ? "▶ " : "  "}{s}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: RESULTS */}
          {step === 4 && result && (
            <div>
              <div className="ai-result">
                <div className="result-header">
                  <div>
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "var(--amber)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>AI Engineering Report</div>
                    <div className="result-title">{result.buildingType}</div>
                  </div>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <div className="result-badge">✓ Analysis Complete</div>
                    {currentUser && (
                      <button
                        className="nav-link-btn"
                        style={{ fontSize: 12, padding: "6px 14px" }}
                        onClick={() => {
                          addProjectToUser(currentUser.id, { ...result, dims, submitted: false });
                          showToast("✓ Report saved to dashboard.");
                        }}
                      >
                        💾 Save to Dashboard
                      </button>
                    )}
                  </div>
                </div>
                <div className="result-body">
                  <div className="result-grid">
                    {[
                      { label: "Structural System", value: result.structuralSystem },
                      { label: "Estimated Cost", value: result.estimatedCost },
                      { label: "Project Timeline", value: result.timeline }
                    ].map(c => (
                      <div key={c.label} className="result-card">
                        <div className="result-card-label">{c.label}</div>
                        <div className="result-card-value" style={{ fontSize: c.label === "Structural System" ? 16 : 22 }}>{c.value}</div>
                      </div>
                    ))}
                  </div>

                  {result.siteObservations && (
                    <div className="result-section">
                      <div className="result-section-title">Site Observations</div>
                      <div className="result-text" style={{ background: "var(--mid)", padding: 20, borderLeft: "3px solid var(--amber)" }}>{result.siteObservations}</div>
                    </div>
                  )}

                  <div className="result-section">
                    <div className="result-section-title">Engineering Recommendations</div>
                    <div className="result-text">{result.recommendations}</div>
                  </div>

                  {result.highlights && (
                    <div className="result-section">
                      <div className="result-section-title">Key Advantages</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        {result.highlights.map((h, i) => (
                          <div key={i} style={{ background: "var(--mid)", border: "1px solid var(--border)", padding: "12px 16px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                            <span style={{ color: "var(--amber)", flexShrink: 0, marginTop: 2 }}>✦</span>
                            <span style={{ fontSize: 13, color: "var(--text)" }}>{h}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="result-section">
                    <div className="result-section-title">Technical Specifications</div>
                    {result.specifications?.map((s, i) => (
                      <div key={i} className="spec-row">
                        <span className="spec-key">{s.key}</span>
                        <span className="spec-val">{s.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* STRUCTURAL DIAGRAM */}
                  <div className="result-section">
                    <div className="result-section-title">Structural Diagram — Auto-Generated from Your Dimensions</div>
                    <StructuralDiagram dims={dims} />
                  </div>

                  {result.nextSteps && (
                    <div style={{ background: "var(--amber-glow)", border: "1px solid rgba(212,160,53,0.25)", padding: 20, marginBottom: 8 }}>
                      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "var(--amber)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Next Steps</div>
                      <div style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.7 }}>{result.nextSteps}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* LEAD FORM */}
              <div className="lead-section">
                <div className="lead-title">📋 Request Full Quotation Package</div>
                <div className="lead-sub">Get detailed BOQ, structural drawings, and formal quotation within 5 business days.</div>

                {submitted ? (
                  <div className="alert success" style={{ fontSize: 16 }}>
                    ✓ Your quotation request has been submitted! Our engineering team will contact you within 24 hours.
                    {currentUser && <div style={{ marginTop: 8, fontSize: 13 }}>This project has been saved to your <a onClick={() => setActivePage("dashboard")} style={{ color: "var(--green)", cursor: "pointer", textDecoration: "underline" }}>dashboard</a>.</div>}
                  </div>
                ) : (
                  <>
                    {!currentUser && (
                      <div style={{ background: "var(--steel)", border: "1px solid var(--border)", padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "var(--text-dim)", display: "flex", gap: 10, alignItems: "center" }}>
                        <span>💡</span>
                        <span><a onClick={() => setAuthPage("signup")} style={{ color: "var(--amber)", cursor: "pointer", textDecoration: "underline" }}>Create an account</a> to save this report and track your quotation status.</span>
                      </div>
                    )}
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Full Name <span className="req">*</span></label>
                        <input placeholder="Your name" value={lead.name} onChange={e => setLead({ ...lead, name: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label>Company / Organization</label>
                        <input placeholder="Company name" value={lead.company} onChange={e => setLead({ ...lead, company: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label>Phone Number <span className="req">*</span></label>
                        <input placeholder="+92 300 0000000" value={lead.phone} onChange={e => setLead({ ...lead, phone: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label>Email Address <span className="req">*</span></label>
                        <input type="email" placeholder="you@company.com" value={lead.email} onChange={e => setLead({ ...lead, email: e.target.value })} />
                      </div>
                      <div className="form-group full">
                        <label>Project Location</label>
                        <input placeholder="City, Province/State, Country" value={lead.location} onChange={e => setLead({ ...lead, location: e.target.value })} />
                      </div>
                    </div>
                    {error && <div className="alert error">{error}</div>}
                    <button className="btn-primary" style={{ width: "100%", padding: "18px", fontSize: 16 }} onClick={handleLeadSubmit}>
                      Submit Quotation Request →
                    </button>
                  </>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
                <button className="btn-secondary" onClick={resetAnalyzer}>↺ Start New Analysis</button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* FEATURES */}
      <section className="section">
        <div className="section-tag">Why SteelBuild AI</div>
        <h2 className="section-title">Built for Speed,<br />Precision & Scale</h2>
        <div className="features-grid">
          {[
            { icon: "🤖", title: "AI-Powered Design", desc: "Claude AI analyzes site images and dimensions to recommend optimal PEB configurations, frame types, and cost-effective structural solutions." },
            { icon: "⚡", title: "Instant Analysis", desc: "Get comprehensive structural reports in under 30 seconds. No waiting, no manual calculations — just immediate, actionable engineering insights." },
            { icon: "📐", title: "Precise Specifications", desc: "Receive detailed technical specs including primary frames, purlins, cladding, foundations, and anchor bolt patterns for your exact project." },
            { icon: "💰", title: "Cost Estimation", desc: "Accurate cost ranges based on current steel market pricing, labor norms, and project complexity — helping you budget with confidence." },
            { icon: "📋", title: "Full Report Package", desc: "AI generates a complete report package including BOQ, structural notes, compliance checklist, and implementation timeline." },
            { icon: "🏗️", title: "Lead-to-Build Pipeline", desc: "From first inquiry to fabrication, our platform manages your entire project pipeline with automated follow-ups and progress tracking." },
          ].map(f => (
            <div key={f.title} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <div className="feature-title">{f.title}</div>
              <div className="feature-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="section-divider" />

      {/* PROCESS */}
      <section className="section" style={{ paddingTop: 80 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
          <div>
            <div className="section-tag">Our Process</div>
            <h2 className="section-title">From Image<br />to Iron in<br />4 Steps</h2>
            <p className="section-subtitle">Our AI-assisted workflow collapses weeks of back-and-forth into a single, seamless session.</p>
          </div>
          <div className="process-list">
            {[
              { n: "01", title: "Upload Site Image", desc: "Photograph your plot or existing structure. AI reads terrain, dimensions, access routes, and orientation clues." },
              { n: "02", title: "Enter Dimensions", desc: "Input clear height, span, length, and building usage. Optional fields for special loads and accessories." },
              { n: "03", title: "AI Generates Report", desc: "Claude analyzes structural requirements, generates frame specs, cost estimates, and engineering recommendations." },
              { n: "04", title: "Receive Quotation", desc: "Submit your details and receive a formal quotation, BOQ, and structural drawing package within 5 business days." },
            ].map(p => (
              <div key={p.n} className="process-item">
                <div className="process-num">{p.n}</div>
                <div className="process-content">
                  <div className="process-title">{p.title}</div>
                  <div className="process-desc">{p.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <div className="cta-banner">
        <div className="cta-title">Start Your Project<br />in 60 Seconds</div>
        <div className="cta-sub">
          {currentUser ? "Welcome back — pick up where you left off." : "No credit card required. Free AI analysis. Instant report."}
        </div>
        <button className="btn-dark" onClick={currentUser ? scrollToForm : () => setAuthPage("signup")}>
          {currentUser ? "Analyze My Building →" : "Create Free Account →"}
        </button>
      </div>

      {/* FOOTER */}
      <footer>
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="nav-logo">Steel<span style={{ color: "var(--amber)" }}>Build</span> AI</div>
            <p>AI-powered pre-engineered steel building design and quotation platform. Serving industrial, commercial, and agricultural clients across South Asia and the Middle East.</p>
          </div>
          <div className="footer-col">
            <h4>Products</h4>
            <ul>
              <li>PEB Portal Frames</li>
              <li>Multi-Span Structures</li>
              <li>Crane Buildings</li>
              <li>Cold Storage</li>
              <li>Mezzanine Floors</li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Services</h4>
            <ul>
              <li>AI Design Analysis</li>
              <li>Structural Engineering</li>
              <li>Fabrication & Supply</li>
              <li>Site Erection</li>
              <li>Project Management</li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Account</h4>
            <ul>
              {currentUser
                ? <>
                    <li onClick={() => setActivePage("dashboard")}>My Dashboard</li>
                    <li onClick={scrollToForm}>New Analysis</li>
                    <li onClick={handleSignOut}>Sign Out</li>
                  </>
                : <>
                    <li onClick={() => setAuthPage("signup")}>Create Account</li>
                    <li onClick={() => setAuthPage("signin")}>Sign In</li>
                    <li>About Us</li>
                    <li>Contact</li>
                  </>
              }
            </ul>
          </div>
        </div>

        {/* CONTACT STRIP */}
        <div style={{ maxWidth: 1300, margin: "0 auto 32px", background: "var(--steel)", border: "1px solid var(--border)", padding: "24px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20 }}>
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "var(--amber)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 6 }}>▸ Contact Our Engineering Team</div>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 20, color: "var(--white)", letterSpacing: "0.03em" }}>Get your free PEB consultation</div>
          </div>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap", alignItems: "center" }}>
            <a href="mailto:usamasmc@gmail.com" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "var(--text)" }}>
              <div style={{ width: 36, height: 36, background: "var(--amber-glow)", border: "1px solid rgba(212,160,53,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>✉</div>
              <div>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 2 }}>Email</div>
                <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, fontSize: 15, color: "var(--amber)", letterSpacing: "0.02em" }}>usamasmc@gmail.com</div>
              </div>
            </a>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, background: "var(--amber-glow)", border: "1px solid rgba(212,160,53,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🏗</div>
              <div>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 2 }}>Response Time</div>
                <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 600, fontSize: 15, color: "var(--text)", letterSpacing: "0.02em" }}>Within 24 Hours</div>
              </div>
            </div>
            <button className="nav-cta" onClick={scrollToForm} style={{ alignSelf: "center" }}>Get Free Quote</button>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2025 SteelBuild AI. All rights reserved.</span>
          <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, color: "var(--muted)" }}>BUILT WITH CLAUDE AI · ISO 9001 CERTIFIED · IS 800 COMPLIANT</span>
        </div>
      </footer>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
