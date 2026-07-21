/**
 * UtilHub — High-Performance CS2 Tactical Reference
 * Mobile-first, OLED-optimized, React SPA (offline mode).
 */

import { useState, useEffect } from "react";
import { db, auth } from "./firebase";
import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  BookMarked, ChevronLeft, Map, Crosshair, Flame,
  Wind, Star, Users, Check, Loader2,
  SlidersHorizontal, Bookmark, BookOpen,
  AlertCircle, Target, Pencil, X
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

// Lineups now live in Firestore (`lineups` collection, seeded via scripts/migrate.mjs)
// and are loaded at runtime — see the `lineups` state + onSnapshot effect in App().

const diffLabel = (n) => ["", "Easy", "Medium", "Hard"][n] || "";
const diffColor = (n) => ["", "#22c55e", "#eab308", "#ef4444"][n] || "#64748b";

// Clusters lineups that land within `threshold` map-percentage-points of each
// other into a single marker group, so overlapping smokes for the same spot
// don't stack as separate icons. Group id is stable regardless of item order.
function groupByPosition(items, threshold = 2) {
  const groups = [];
  for (const item of items) {
    const g = groups.find((g) => {
      const dx = g.position.x - item.position.x;
      const dy = g.position.y - item.position.y;
      return Math.hypot(dx, dy) <= threshold;
    });
    if (g) {
      g.items.push(item);
      g.position = {
        x: g.items.reduce((s, i) => s + i.position.x, 0) / g.items.length,
        y: g.items.reduce((s, i) => s + i.position.y, 0) / g.items.length,
      };
    } else {
      groups.push({ position: { ...item.position }, items: [item] });
    }
  }
  return groups.map((g) => ({ ...g, id: g.items.map((i) => i.id).sort().join("|") }));
}

function MapDot({ group, isActive, onClick }) {
  const primary = group.items[0];
  const count = group.items.length;
  const type = UTIL_TYPES.find((t) => t.id === primary.typeId);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        position: "absolute",
        left: group.position.x + "%",
        top: group.position.y + "%",
        transform: "translate(-50%, -50%)",
        zIndex: isActive ? 20 : 10,
        transition: "all 0.15s ease",
        background: "none",
        border: "none",
        padding: 0,
        margin: 0,
        width: 44,
        height: 44,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        touchAction: "manipulation",
      }}
      aria-label={count > 1 ? `${count} lineups` : primary.name}
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
      {count > 1 && (
        <span style={{
          position: "absolute", top: -3, right: -3, minWidth: 16, height: 16,
          borderRadius: 8, background: "#2563eb", color: "#fff",
          fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center",
          justifyContent: "center", padding: "0 3px", border: "1.5px solid #000",
          fontFamily: "monospace",
        }}>
          {count}
        </span>
      )}
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
  const [editMode,   setEditMode]   = useState(false);
  const [savingPos,  setSavingPos]  = useState(false);
  const [playbook,   setPlaybook]   = useState({});
  const [uid,        setUid]        = useState(null);
  const [lineups,        setLineups]        = useState([]);
  const [lineupsLoading, setLineupsLoading]  = useState(true);
  const [isLandscape,    setIsLandscape]     = useState(false);

  // Track device orientation so the lineup video can go big/fullscreen when
  // the phone is turned sideways.
  useEffect(() => {
    const mq = window.matchMedia("(orientation: landscape)");
    const handler = () => setIsLandscape(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Load lineups from Firestore in real-time
  useEffect(() => {
    return onSnapshot(
      collection(db, "lineups"),
      (snap) => {
        setLineups(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLineupsLoading(false);
      },
      (err) => { console.error(err); setLineupsLoading(false); }
    );
  }, []);

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
    ? lineups.filter((l) => l.mapId === activeMap.id && (activeType === "all" || l.typeId === activeType))
    : [];
  const playbookLineups = lineups.filter((l) => playbook[l.id]);
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
            <button key={id} onClick={() => { setActiveMap(null); setPinned(null); setEditMode(false); setView(id); }}
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
        {lineupsLoading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: 10 }}>
            <Loader2 size={24} color="#3f3f46" style={{ animation: "spin 1s linear infinite" }} />
            <p style={{ color: "#52525b", fontSize: 12, margin: 0 }}>Loading lineups…</p>
          </div>
        ) : (
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
                    {lineups.filter((l) => l.mapId === m.id).length} utils
                  </span>
                </div>
                <p style={{ color: "#a1a1aa", fontSize: 13, marginTop: 4, marginBottom: 0 }}>
                  {UTIL_TYPES.map((t) => {
                    const n = lineups.filter((l) => l.mapId === m.id && l.typeId === t.id).length;
                    return n > 0 ? `${n} ${t.label}` : null;
                  }).filter(Boolean).join(" · ")}
                </p>
              </div>
            </button>
          ))}
        </div>
        )}
      </div>
      <BottomNav />
    </div>
  );

  const ViewMapView = () => {
    const map = activeMap;
    if (!map) return null;

    const effectiveLineups = mapLineups;
    // In edit mode keep every lineup as its own marker (1 item per group) so
    // repositioning stays unambiguous; otherwise cluster same-spot smokes.
    const displayGroups = editMode
      ? effectiveLineups.map((l) => ({ id: l.id, position: l.position, items: [l] }))
      : groupByPosition(effectiveLineups);
    const pinnedGroup = displayGroups.find((g) => g.id === pinned);
    const pinnedLineup = pinnedGroup && pinnedGroup.items.length === 1 ? pinnedGroup.items[0] : null;

    const handleMapClick = (e) => {
      if (!editMode || !pinnedLineup) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
      const y = Math.max(0, Math.min(100, Math.round(((e.clientY - rect.top) / rect.height) * 100)));
      setSavingPos(true);
      setDoc(doc(db, "lineups", pinnedLineup.id), { position: { x, y } }, { merge: true })
        .catch(console.error)
        .finally(() => setSavingPos(false));
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid #18181b" }}>
          <button onClick={() => { setView("MAP_SELECT"); setActiveMap(null); setPinned(null); setEditMode(false); }}
            style={{ background: "#18181b", border: "none", borderRadius: 8, padding: 8, cursor: "pointer" }}>
            <ChevronLeft size={18} color="#a1a1aa" />
          </button>
          <div style={{ flex: 1 }}>
            <p style={{ color: "#fff", fontWeight: 700, fontSize: 16, margin: 0 }}>{map.name}</p>
            <p style={{ color: "#52525b", fontSize: 11, fontFamily: "monospace", margin: 0 }}>{effectiveLineups.length} LINEUPS</p>
          </div>
          <button onClick={() => setEditMode((v) => !v)}
            style={{ display: "flex", alignItems: "center", gap: 6, background: editMode ? "#2563eb" : "#18181b", border: "none", borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}>
            {editMode ? <X size={16} color="#fff" /> : <Pencil size={16} color="#a1a1aa" />}
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace", color: editMode ? "#fff" : "#a1a1aa" }}>
              {editMode ? "DONE" : "EDIT"}
            </span>
          </button>
        </header>
        {editMode && (
          <div style={{ padding: "8px 16px", background: "#2563eb22", borderBottom: "1px solid #2563eb55" }}>
            <p style={{ color: "#60a5fa", fontSize: 12, margin: 0 }}>
              {pinnedLineup
                ? `Tap the map to move "${pinnedLineup.name}"${savingPos ? " · saving…" : ""}`
                : "Select a marker below, then tap the map to reposition it"}
            </p>
          </div>
        )}
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
          onClick={handleMapClick}
          style={{ position: "relative", margin: "0 16px", borderRadius: 12, overflow: "hidden", border: editMode ? "2px solid #2563eb" : "1px solid #27272a", background: "#0a0a0a", aspectRatio: "1/1", cursor: editMode && pinnedLineup ? "crosshair" : "default" }}>
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
          {displayGroups.map((g) => (
            <MapDot
              key={g.id}
              group={g}
              isActive={pinned === g.id}
              onClick={() => setPinned(pinned === g.id ? null : g.id)}
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
          ) : pinnedGroup ? (
            <div style={{ background: "#18181b", border: `1px solid ${UTIL_TYPES.find((t) => t.id === pinnedGroup.items[0].typeId)?.color ?? "#27272a"}55`, borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <p style={{ color: "#fff", fontWeight: 700, fontSize: 15, margin: 0 }}>
                  {pinnedGroup.items.every((i) => i.target === pinnedGroup.items[0].target) ? pinnedGroup.items[0].target : "Multiple targets"}
                </p>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#71717a", fontFamily: "monospace", letterSpacing: "0.06em" }}>
                  {pinnedGroup.items.length} LINEUPS
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {pinnedGroup.items.map((item) => {
                  const type = UTIL_TYPES.find((t) => t.id === item.typeId);
                  return (
                    <button key={item.id} onClick={() => { setDetail(item); setView("DETAIL"); }}
                      style={{ display: "flex", alignItems: "center", gap: 10, background: "#131316", border: "1px solid #27272a", borderRadius: 10, padding: "10px 12px", textAlign: "left", cursor: "pointer", width: "100%" }}>
                      <span style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: type?.color + "22", border: `1px solid ${type?.color}55`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {type && <type.icon size={13} color={type.color} />}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: "#fff", fontWeight: 600, fontSize: 13, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</p>
                        {item.stats?.throw && (
                          <p style={{ color: "#71717a", fontSize: 11, margin: "2px 0 0" }}>{item.stats.throw}</p>
                        )}
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 700, color: diffColor(item.difficulty), fontFamily: "monospace", flexShrink: 0 }}>
                        {diffLabel(item.difficulty)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <p style={{ color: "#3f3f46", fontSize: 10, fontFamily: "monospace", letterSpacing: "0.1em", marginBottom: 2 }}>TAP A MARKER ON THE MAP</p>
              {mapLineups.map((l) => {
                const type = UTIL_TYPES.find((t) => t.id === l.typeId);
                return (
                  <button key={l.id} onClick={() => setPinned(l.id)}
                    style={{ display: "flex", alignItems: "center", gap: 8, background: "#131316", border: "1px solid #1f1f23", borderRadius: 8, padding: "6px 10px", textAlign: "left", cursor: "pointer", width: "100%" }}>
                    <span style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, background: type?.color + "22", border: `1px solid ${type?.color}55`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {type && <type.icon size={10} color={type.color} />}
                    </span>
                    <p style={{ flex: 1, minWidth: 0, color: "#a1a1aa", fontWeight: 500, fontSize: 12, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.name}</p>
                    <span style={{ color: diffColor(l.difficulty), fontSize: 9, fontWeight: 700, fontFamily: "monospace", flexShrink: 0 }}>
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

    // Turn the phone sideways -> the lineup video takes over the whole
    // screen instead of being squeezed into the portrait card layout.
    if (isLandscape && detail.media) {
      const isVideo = detail.media.endsWith(".mp4") || detail.media.endsWith(".webm");
      return (
        <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {isVideo ? (
            <video key={detail.id} src={detail.media} controls autoPlay loop muted playsInline style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", transform: "scale(1.28) translate(4%, -4%)" }} />
          ) : (
            <img src={detail.media} alt={detail.name} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
          )}
          <button onClick={() => setView(activeMap ? "MAP_VIEW" : "PLAYBOOK")}
            style={{ position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,0.6)", border: "none", borderRadius: 8, padding: 8, cursor: "pointer" }}>
            <ChevronLeft size={20} color="#fff" />
          </button>
          <div style={{ position: "absolute", top: 12, right: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: "rgba(0,0,0,0.6)", borderRadius: 6, padding: "4px 9px" }}>
              {detail.name}
            </span>
            <button onClick={() => toggleSave(detail)}
              style={{ background: saved ? "#22c55e" : "rgba(0,0,0,0.6)", border: "none", borderRadius: 8, padding: 8, cursor: "pointer", display: "flex" }}>
              {saved ? <Check size={16} color="#000" /> : <Bookmark size={16} color="#fff" />}
            </button>
          </div>
        </div>
      );
    }

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
          <div style={{ aspectRatio: "4/2.6", width: "100%", background: "#18181b", overflow: "hidden" }}>
            {detail.media ? (
              detail.media.endsWith(".mp4") || detail.media.endsWith(".webm") ? (
                <video key={detail.id} src={detail.media} controls autoPlay loop muted playsInline style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", background: "#000", transform: "scale(1.28) translate(4%, -4%)" }} />
              ) : (
                <img src={detail.media} alt={detail.name} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85, display: "block" }} />
              )
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <AlertCircle size={24} color="#3f3f46" />
                <p style={{ color: "#52525b", fontSize: 12, margin: 0 }}>No video yet</p>
              </div>
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
      <header style={{ width: "100%", borderBottom: "1px solid #18181b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "22px 16px 16px" }}>
          <BookMarked size={26} color="#2563eb" />
          <div>
            <p style={{ color: "#fff", fontWeight: 700, fontSize: 19, margin: 0 }}>My Playbook</p>
            <p style={{ color: "#52525b", fontSize: 12, fontFamily: "monospace", margin: 0 }}>{playbookLineups.length} SAVED</p>
          </div>
        </div>
      </header>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
        {playbookLineups.length === 0 ? <EmptyPlaybook /> : MAPS.filter((m) => playbookByMap[m.id]).map((m) => (
          <div key={m.id} style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 5, height: 22, borderRadius: 3, background: m.accent }} />
              <p style={{ color: m.accent, fontWeight: 700, fontSize: 16, fontFamily: "monospace", letterSpacing: "0.08em", margin: 0 }}>{m.name.toUpperCase()}</p>
            </div>
            {playbookByMap[m.id].map((l) => {
              const type = UTIL_TYPES.find((t) => t.id === l.typeId);
              return (
                <button key={l.id}
                  onClick={() => { setActiveMap(MAPS.find((mm) => mm.id === l.mapId)); setDetail(l); setView("DETAIL"); }}
                  style={{ display: "flex", alignItems: "center", gap: 16, background: "#18181b", border: "1px solid #27272a", borderRadius: 14, padding: "18px 16px", textAlign: "left", cursor: "pointer", marginBottom: 10, width: "100%" }}>
                  <span style={{ width: 48, height: 48, borderRadius: "50%", flexShrink: 0, background: type?.color + "22", border: `1px solid ${type?.color}55`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {type && <type.icon size={22} color={type.color} />}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: "#fff", fontWeight: 700, fontSize: 17, margin: 0 }}>{l.name}</p>
                    <p style={{ color: "#71717a", fontSize: 14, margin: "3px 0 0" }}>{l.target}</p>
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
      <div style={{ maxWidth: 600, width: "100%", margin: "0 auto", height: "100dvh", background: "#000", display: "flex", flexDirection: "column", fontFamily: "monospace, -apple-system, sans-serif", overflow: "hidden" }}>
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