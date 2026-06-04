/**
 * UtilHub — High-Performance CS2 Tactical Reference
 * Mobile-first, OLED-optimized, React SPA (offline mode).
 */

import { useState, useEffect } from "react";
import { db, auth } from "./firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  BookMarked, ChevronLeft, Map, Crosshair, Flame,
  Wind, Star, Users, Check, Loader2,
  SlidersHorizontal, Bookmark, BookOpen,
  AlertCircle, Target
} from "lucide-react";

const MAPS = [
  { id: "mirage",  name: "Mirage",  accent: "#e8a020", radar: "https://raw.githubusercontent.com/2mlml/cs2-radar-images/master/de_mirage.png",  thumbnail: "https://raw.githubusercontent.com/ghostcap-gaming/cs2-map-images/main/cs2/de_mirage.png" },
  { id: "inferno", name: "Inferno", accent: "#e84020", radar: "https://raw.githubusercontent.com/2mlml/cs2-radar-images/master/de_inferno.png", thumbnail: "https://raw.githubusercontent.com/ghostcap-gaming/cs2-map-images/main/cs2/de_inferno.png" },
  { id: "dust2",   name: "Dust II", accent: "#d4a855", radar: "https://raw.githubusercontent.com/2mlml/cs2-radar-images/master/de_dust2.png",   thumbnail: "https://raw.githubusercontent.com/ghostcap-gaming/cs2-map-images/main/cs2/de_dust2.png" },
];

const UTIL_TYPES = [
  { id: "smoke", label: "Smoke", icon: Wind,   color: "#64748b" },
  { id: "molly", label: "Molly", icon: Flame,  color: "#ef4444" },
  { id: "flash", label: "Flash", icon: Star,   color: "#eab308" },
  { id: "nade",  label: "Nade",  icon: Target, color: "#22c55e" },
];

const LINEUPS = [
  {
    id: "mir_window_smoke",
    mapId: "mirage", typeId: "smoke",
    name: "Window Smoke", target: "Mid Window", difficulty: 2,
    position: { x: 40, y: 45 },
    media: "https://assets.csnades.gg/nades/mirage-smoke-VrvjVQyEOz/hq.mp4",
    stats: { airTime: 7.2, throwTime: 7.9, throw: "Running + Jump Throw", precision: "Precise", side: "T" },
  },
  {
    id: "mir_con_smoke",
    mapId: "mirage", typeId: "smoke",
    name: "Connector Smoke", target: "Connector", difficulty: 2,
    position: { x: 50, y: 52 },
    media: "https://assets.csnades.gg/nades/mirage-smoke-gix2YshKRu/hq.mp4",
    stats: { airTime: 6.1, throwTime: 10.2, throw: "Jump Throw", precision: "Very Precise", side: "T" },
  },
  {
    id: "mir_stairs_smoke",
    mapId: "mirage", typeId: "smoke",
    name: "Stairs Smoke", target: "A-Site Stairs", difficulty: 1,
    position: { x: 55, y: 65 },
    media: "https://assets.csnades.gg/nades/mirage-smoke-HM7RUQkS6z/hq.mp4",
    stats: { airTime: 9.4, throwTime: 8.9, throw: "Jump Throw", precision: "Precise", side: "T" },
  },
  {
    id: "mir_ct_smoke",
    mapId: "mirage", typeId: "smoke",
    name: "CT Smoke", target: "CT Spawn", difficulty: 3,
    position: { x: 45, y: 80 },
    media: "https://placehold.co/640x360/0f172a/2563eb?text=CT+Smoke&font=montserrat",
    stats: null,
  },
  {
    id: "mir_jungle_smoke",
    mapId: "mirage", typeId: "smoke",
    name: "Jungle Smoke", target: "Jungle", difficulty: 2,
    position: { x: 50, y: 65 },
    media: "https://assets.csnades.gg/nades/mirage-smoke-5w0tr1Gtez/hq.mp4",
    stats: { airTime: 9.7, throwTime: 9.0, throw: "Jump Throw", precision: "Precise", side: "T" },
  },
  {
    id: "inf_coffins_smoke",
    mapId: "inferno", typeId: "smoke",
    name: "Coffins Smoke", target: "B-Site Coffins", difficulty: 2,
    position: { x: 68, y: 55 },
    media: "https://assets.csnades.gg/nades/inferno-smoke-j6asRNfisY/hq.mp4",
    stats: { airTime: 4.5, throwTime: 11.0, throw: "Running + Jump Throw", precision: "Very Precise", side: "T" },
  },
  {
    id: "d2_xbox_smoke",
    mapId: "dust2", typeId: "smoke",
    name: "Xbox Smoke", target: "Mid Xbox", difficulty: 3,
    position: { x: 50, y: 50 },
    media: "https://assets.csnades.gg/nades/dust2-smoke-pXWCQLmYhk/hq.mp4",
    stats: { airTime: 5.8, throwTime: 8.5, throw: "Jump Throw", precision: "Precise", side: "T" },
  },
];

const diffLabel = (n) => ["", "Easy", "Medium", "Hard"][n] || "";
const diffColor = (n) => ["", "#22c55e", "#eab308", "#ef4444"][n] || "#64748b";

function MapDot({ lineup, isActive, onClick }) {
  const type = UTIL_TYPES.find((t) => t.id === lineup.typeId);
  return (
    <button
      onClick={onClick}
      style={{
        position: "absolute",
        left: lineup.position.x + "%",
        top: lineup.position.y + "%",
        transform: "translate(-50%, -50%)",
        zIndex: isActive ? 20 : 10,
        transition: "all 0.15s ease",
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
      }}
      aria-label={lineup.name}
    >
      {isActive && (
        <span style={{
          position: "absolute", inset: "-8px", borderRadius: "50%",
          border: `2px solid ${type?.color || "#2563eb"}`,
          animation: "ping 1.2s cubic-bezier(0,0,0.2,1) infinite",
        }} />
      )}
      <span style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: isActive ? 34 : 26, height: isActive ? 34 : 26,
        borderRadius: "50%",
        background: isActive ? (type?.color || "#2563eb") : "#18181b",
        border: `2px solid ${type?.color || "#2563eb"}`,
        boxShadow: isActive ? `0 0 12px ${type?.color}88` : "none",
        transition: "all 0.15s ease",
      }}>
        {type && <type.icon size={isActive ? 16 : 12} color={isActive ? "#fff" : type.color} />}
      </span>
    </button>
  );
}


function EmptyPlaybook() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: 12 }}>
      <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#18181b", border: "2px dashed #3f3f46", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <BookOpen size={30} color="#3f3f46" />
      </div>
      <p style={{ color: "#71717a", fontSize: 15, fontWeight: 500, margin: 0 }}>No lineups saved yet</p>
      <p style={{ color: "#52525b", fontSize: 13, textAlign: "center", maxWidth: 220, margin: 0 }}>Browse any map and hit Save on a lineup to add it here.</p>
    </div>
  );
}

export default function App() {
  const [view,       setView]       = useState("MAP_SELECT");
  const [activeMap,  setActiveMap]  = useState(null);
  const [activeType, setActiveType] = useState("all");
  const [pinned,     setPinned]     = useState(null);
  const [detail,     setDetail]     = useState(null);
  const [playbook,   setPlaybook]   = useState({});
  const [uid,        setUid]        = useState(null);

  // Sign in anonymously so every device gets a persistent playbook
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (user) {
        setUid(user.uid);
      } else {
        signInAnonymously(auth).catch(console.error);
      }
    });
  }, []);

  // Sync playbook from Firestore in real-time
  useEffect(() => {
    if (!uid) return;
    const ref = doc(db, "playbooks", uid);
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) setPlaybook(snap.data().saved ?? {});
    }, console.error);
  }, [uid]);

  const mapLineups = activeMap
    ? LINEUPS.filter((l) => l.mapId === activeMap.id && (activeType === "all" || l.typeId === activeType))
    : [];
  const playbookLineups = LINEUPS.filter((l) => playbook[l.id]);
  const playbookByMap = MAPS.reduce((acc, m) => {
    const ls = playbookLineups.filter((l) => l.mapId === m.id);
    if (ls.length) acc[m.id] = ls;
    return acc;
  }, {});
  const isSaved = (id) => !!playbook[id];
  const toggleSave = (lineup) => {
    setPlaybook((prev) => {
      const next = { ...prev };
      if (next[lineup.id]) { delete next[lineup.id]; } else { next[lineup.id] = true; }
      if (uid) setDoc(doc(db, "playbooks", uid), { saved: next }).catch(console.error);
      return next;
    });
  };

  function BottomNav() {
    const tabs = [
      { id: "MAP_SELECT", label: "Maps",     icon: Map },
      { id: "PLAYBOOK",   label: "Playbook", icon: BookMarked },
    ];
    return (
      <nav style={{ display: "flex", borderTop: "1px solid #18181b", background: "#000", paddingBottom: 8 }}>
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = view === id || (view === "MAP_VIEW" && id === "MAP_SELECT");
          return (
            <button key={id} onClick={() => { setActiveMap(null); setPinned(null); setView(id); }}
              style={{ flex: 1, padding: "12px 0 10px", background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: active ? "#2563eb" : "#52525b", transition: "color 0.15s" }}>
              <Icon size={20} />
              <span style={{ fontSize: 10, fontWeight: 600, fontFamily: "monospace", letterSpacing: "0.06em" }}>{label.toUpperCase()}</span>
            </button>
          );
        })}
      </nav>
    );
  }

  const ViewMapSelect = () => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <header style={{ padding: "20px 16px 12px", borderBottom: "1px solid #18181b", background: "#000" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Crosshair size={20} color="#2563eb" />
          <span style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, color: "#fff", letterSpacing: "0.08em" }}>UTILHUB</span>
        </div>
        <p style={{ color: "#52525b", fontSize: 11, marginTop: 4, fontFamily: "monospace" }}>CS2 TACTICAL REFERENCE</p>
      </header>
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        <p style={{ color: "#71717a", fontSize: 12, fontFamily: "monospace", letterSpacing: "0.1em", marginBottom: 14 }}>SELECT MAP</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {MAPS.map((m) => (
            <button key={m.id}
              onClick={() => { setActiveMap(m); setPinned(null); setView("MAP_VIEW"); }}
              style={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 12, overflow: "hidden", textAlign: "left", cursor: "pointer" }}>
              <div style={{ height: 120, overflow: "hidden", position: "relative", borderBottom: "1px solid #27272a" }}>
                {m.thumbnail ? (
                  <img src={m.thumbnail} alt={m.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", opacity: 0.9 }} />
                ) : (
                  <div style={{ height: "100%", background: `linear-gradient(135deg, #111 0%, ${m.accent}22 100%)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Map size={28} color={m.accent} />
                  </div>
                )}
                <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom, transparent 40%, #18181b 100%)` }} />
              </div>
              <div style={{ padding: "12px 14px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>{m.name}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: m.accent }}>
                    {LINEUPS.filter((l) => l.mapId === m.id).length} utils
                  </span>
                </div>
                <p style={{ color: "#a1a1aa", fontSize: 13, marginTop: 4, marginBottom: 0 }}>
                  {UTIL_TYPES.map((t) => {
                    const n = LINEUPS.filter((l) => l.mapId === m.id && l.typeId === t.id).length;
                    return n > 0 ? `${n} ${t.label}` : null;
                  }).filter(Boolean).join(" · ")}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  );

  const ViewMapView = () => {
    const map = activeMap;
    if (!map) return null;

    const effectiveLineups = mapLineups;
    const pinnedLineup = effectiveLineups.find((l) => l.id === pinned);

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid #18181b" }}>
          <button onClick={() => { setView("MAP_SELECT"); setActiveMap(null); setPinned(null); }}
            style={{ background: "#18181b", border: "none", borderRadius: 8, padding: 8, cursor: "pointer" }}>
            <ChevronLeft size={18} color="#a1a1aa" />
          </button>
          <div style={{ flex: 1 }}>
            <p style={{ color: "#fff", fontWeight: 700, fontSize: 16, margin: 0 }}>{map.name}</p>
            <p style={{ color: "#52525b", fontSize: 11, fontFamily: "monospace", margin: 0 }}>{effectiveLineups.length} LINEUPS</p>
          </div>
        </header>
        <div style={{ padding: "10px 16px", display: "flex", gap: 8, overflowX: "auto" }}>
          {[{ id: "all", label: "All", icon: SlidersHorizontal, color: "#a1a1aa" }, ...UTIL_TYPES].map((t) => {
            const active = activeType === t.id;
            return (
              <button key={t.id} onClick={() => { setActiveType(t.id); setPinned(null); }}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 20, border: `1px solid ${active ? t.color : "#27272a"}`, background: active ? t.color + "22" : "#18181b", color: active ? t.color : "#71717a", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                <t.icon size={12} />{t.label}
              </button>
            );
          })}
        </div>
        <div
          style={{ position: "relative", margin: "0 16px", borderRadius: 12, overflow: "hidden", border: "1px solid #27272a", background: "#0a0a0a", aspectRatio: "1/1", maxHeight: "42vw" }}>
          {map.radar ? (
            <img
              src={map.radar}
              alt={`${map.name} radar`}
              draggable={false}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.8, userSelect: "none" }}
            />
          ) : (
            <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, #111 0%, ${map.accent}18 100%)`, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.06 }}>
              <Map size={80} color={map.accent} />
            </div>
          )}
          {effectiveLineups.map((l) => (
            <MapDot
              key={l.id}
              lineup={l}
              isActive={pinned === l.id}
              onClick={() => setPinned(pinned === l.id ? null : l.id)}
            />
          ))}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          {pinnedLineup ? (
            <div style={{ background: "#18181b", border: `1px solid ${UTIL_TYPES.find((t) => t.id === pinnedLineup.typeId)?.color ?? "#27272a"}55`, borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
                <div>
                  <p style={{ color: "#fff", fontWeight: 700, fontSize: 15, margin: 0 }}>{pinnedLineup.name}</p>
                  <p style={{ color: "#71717a", fontSize: 12, margin: "4px 0 0" }}>→ {pinnedLineup.target}</p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: diffColor(pinnedLineup.difficulty), background: diffColor(pinnedLineup.difficulty) + "22", borderRadius: 6, padding: "2px 8px", whiteSpace: "nowrap", fontFamily: "monospace" }}>
                  {diffLabel(pinnedLineup.difficulty)}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setDetail(pinnedLineup); setView("DETAIL"); }}
                  style={{ flex: 1, padding: 10, borderRadius: 8, background: "#2563eb", border: "none", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  View Lineup
                </button>
                <button onClick={() => toggleSave(pinnedLineup)}
                  style={{ padding: "10px 14px", borderRadius: 8, cursor: "pointer", border: `1px solid ${isSaved(pinnedLineup.id) ? "#22c55e" : "#27272a"}`, background: isSaved(pinnedLineup.id) ? "#22c55e22" : "#27272a", color: isSaved(pinnedLineup.id) ? "#22c55e" : "#a1a1aa", display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600 }}>
                  {isSaved(pinnedLineup.id) ? <><Check size={14} /> Saved</> : <><Bookmark size={14} /> Save</>}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ color: "#52525b", fontSize: 11, fontFamily: "monospace", letterSpacing: "0.1em", marginBottom: 4 }}>TAP A MARKER OR SELECT BELOW</p>
              {mapLineups.map((l) => {
                const type = UTIL_TYPES.find((t) => t.id === l.typeId);
                return (
                  <button key={l.id} onClick={() => { setDetail(l); setView("DETAIL"); }}
                    style={{ display: "flex", alignItems: "center", gap: 12, background: "#18181b", border: "1px solid #27272a", borderRadius: 10, padding: "12px 14px", textAlign: "left", cursor: "pointer", width: "100%" }}>
                    <span style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, background: type?.color + "22", border: `1px solid ${type?.color}55`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {type && <type.icon size={15} color={type.color} />}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: "#fff", fontWeight: 600, fontSize: 14, margin: 0 }}>{l.name}</p>
                      <p style={{ color: "#71717a", fontSize: 12, margin: 0 }}>{l.target}</p>
                    </div>
                    <span style={{ color: diffColor(l.difficulty), fontSize: 11, fontWeight: 700, fontFamily: "monospace" }}>
                      {diffLabel(l.difficulty)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <BottomNav />
      </div>
    );
  };

  const ViewDetail = () => {
    if (!detail) return null;
    const type  = UTIL_TYPES.find((t) => t.id === detail.typeId);
    const map   = MAPS.find((m) => m.id === detail.mapId);
    const saved = isSaved(detail.id);
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid #18181b" }}>
          <button onClick={() => setView(activeMap ? "MAP_VIEW" : "PLAYBOOK")}
            style={{ background: "#18181b", border: "none", borderRadius: 8, padding: 8, cursor: "pointer" }}>
            <ChevronLeft size={18} color="#a1a1aa" />
          </button>
          <div style={{ flex: 1 }}>
            <p style={{ color: "#fff", fontWeight: 700, fontSize: 15, margin: 0 }}>{detail.name}</p>
            <p style={{ color: "#52525b", fontSize: 11, fontFamily: "monospace", margin: 0 }}>{map?.name?.toUpperCase()} · {type?.label?.toUpperCase()}</p>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: diffColor(detail.difficulty), background: diffColor(detail.difficulty) + "22", borderRadius: 6, padding: "3px 9px", fontFamily: "monospace" }}>
            {diffLabel(detail.difficulty)}
          </span>
        </header>
        <div style={{ flex: 1, overflowY: "auto" }}>
          <div style={{ aspectRatio: "4/3", width: "100%", background: "#18181b" }}>
            {detail.media.endsWith(".mp4") || detail.media.endsWith(".webm") ? (
              <video src={detail.media} controls autoPlay loop muted playsInline style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", background: "#000" }} />
            ) : (
              <img src={detail.media} alt={detail.name} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85, display: "block" }} />
            )}
          </div>
          <div style={{ padding: 16 }}>
            {detail.stats ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: "Air Time",  value: `${detail.stats.airTime}s` },
                  { label: "Throw Time", value: `${detail.stats.throwTime}s` },
                  { label: "Throw",     value: detail.stats.throw },
                  { label: "Precision", value: detail.stats.precision },
                  { label: "Side",      value: detail.stats.side },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 10, padding: "12px 14px" }}>
                    <p style={{ color: "#52525b", fontSize: 10, fontFamily: "monospace", letterSpacing: "0.08em", margin: "0 0 4px" }}>{label.toUpperCase()}</p>
                    <p style={{ color: "#fff", fontSize: 14, fontWeight: 600, margin: 0 }}>{value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px", background: "#18181b", border: "1px solid #27272a", borderRadius: 10 }}>
                <AlertCircle size={15} color="#71717a" />
                <p style={{ color: "#71717a", fontSize: 13, margin: 0 }}>No stats available for this lineup yet.</p>
              </div>
            )}
          </div>
        </div>
        <div style={{ padding: "12px 16px 16px", borderTop: "1px solid #18181b", background: "#000" }}>
          <button onClick={() => toggleSave(detail)}
            style={{ width: "100%", padding: 15, borderRadius: 12, border: "none", background: saved ? "#22c55e22" : "#2563eb", color: saved ? "#22c55e" : "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: saved ? "none" : "0 0 20px #2563eb44" }}>
            {saved ? <><Check size={18} /> Saved to Playbook</> : <><Bookmark size={18} /> Save to Playbook</>}
          </button>
        </div>
      </div>
    );
  };

  const ViewPlaybook = () => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <header style={{ padding: "20px 16px 12px", borderBottom: "1px solid #18181b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <BookMarked size={20} color="#2563eb" />
          <div>
            <p style={{ color: "#fff", fontWeight: 700, fontSize: 16, margin: 0 }}>My Playbook</p>
            <p style={{ color: "#52525b", fontSize: 11, fontFamily: "monospace", margin: 0 }}>{playbookLineups.length} SAVED</p>
          </div>
        </div>
      </header>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
        {playbookLineups.length === 0 ? <EmptyPlaybook /> : MAPS.filter((m) => playbookByMap[m.id]).map((m) => (
          <div key={m.id} style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 4, height: 16, borderRadius: 2, background: m.accent }} />
              <p style={{ color: m.accent, fontWeight: 700, fontSize: 13, fontFamily: "monospace", letterSpacing: "0.08em", margin: 0 }}>{m.name.toUpperCase()}</p>
            </div>
            {playbookByMap[m.id].map((l) => {
              const type = UTIL_TYPES.find((t) => t.id === l.typeId);
              return (
                <button key={l.id}
                  onClick={() => { setActiveMap(MAPS.find((mm) => mm.id === l.mapId)); setDetail(l); setView("DETAIL"); }}
                  style={{ display: "flex", alignItems: "center", gap: 12, background: "#18181b", border: "1px solid #27272a", borderRadius: 10, padding: "11px 13px", textAlign: "left", cursor: "pointer", marginBottom: 6, width: "100%" }}>
                  <span style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: type?.color + "22", border: `1px solid ${type?.color}55`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {type && <type.icon size={14} color={type.color} />}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: "#fff", fontWeight: 600, fontSize: 14, margin: 0 }}>{l.name}</p>
                    <p style={{ color: "#71717a", fontSize: 12, margin: 0 }}>{l.target}</p>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <BottomNav />
    </div>
  );

  return (
    <>
      <style>{`
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body { margin: 0; background: #000; }
        @keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 0; }
      `}</style>
      <div style={{ maxWidth: 430, margin: "0 auto", height: "100dvh", background: "#000", display: "flex", flexDirection: "column", fontFamily: "monospace, -apple-system, sans-serif", overflow: "hidden" }}>
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {view === "MAP_SELECT" && <ViewMapSelect />}
          {view === "MAP_VIEW"   && <ViewMapView />}
          {view === "DETAIL"     && <ViewDetail />}
          {view === "PLAYBOOK"   && <ViewPlaybook />}
        </div>
      </div>
    </>
  );
}