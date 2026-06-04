const API_KEY    = "AIzaSyAn1ydyt6GhleXzAvqNXcfZG0G7AweOM8Y";
const PROJECT_ID = "deft-chariot-498407-p4";
const BASE_URL   = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

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
    media: null,
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

// Convert a JS value to Firestore REST field format
function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "string")  return { stringValue: val };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number")  return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  if (typeof val === "object") {
    const fields = {};
    for (const [k, v] of Object.entries(val)) fields[k] = toFirestoreValue(v);
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function toFirestoreDoc(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === "id") continue; // id is the document name, not a field
    fields[k] = toFirestoreValue(v);
  }
  return { fields };
}

async function migrate() {
  console.log(`Migrating ${LINEUPS.length} lineups via REST API...`);
  for (const lineup of LINEUPS) {
    const url = `${BASE_URL}/lineups/${lineup.id}?key=${API_KEY}`;
    const body = JSON.stringify(toFirestoreDoc(lineup));
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`  ✗ ${lineup.id}: ${res.status} ${err}`);
    } else {
      console.log(`  ✓ ${lineup.id}`);
    }
  }
  console.log("Done.");
  process.exit(0);
}

migrate().catch((err) => { console.error(err); process.exit(1); });
