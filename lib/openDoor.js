// Gemensam logik för att öppna porten via Stockholm Parkering.
// Används både av server.js (lokalt/Render) och api/open.js (Vercel).

const DOORS = require("../public/doors.json");

const BASE        = "https://portal2.stockholmparkering.se";
const FACILITY_ID = "105243";
const POST_PATH   = "/passage/OpenDoor";
const TIMEOUT_MS  = 10000;

async function openDoor(rawRegnr, rawDoorId) {
  const regnr = (rawRegnr || "").toUpperCase().replace(/\s/g, "");
  if (!regnr) return { status: 200, ok: false, msg: "Registreringsnummer saknas." };

  // Bara kända dörrar tillåts; utan doorId används första dörren (äldre klienter)
  const door = rawDoorId ? DOORS.find(d => d.id === String(rawDoorId)) : DOORS[0];
  if (!door) return { status: 400, ok: false, msg: "Okänd dörr." };

  const GET_PATH = `/passage?anlaggningsId=${FACILITY_ID}&dorrId=${door.id}`;

  try {
    // 1. GET – hämta CSRF-token och session-cookie
    const getRes = await fetch(BASE + GET_PATH, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
      signal:  AbortSignal.timeout(TIMEOUT_MS),
    });
    const html = await getRes.text();

    // Extrahera CSRF-token (hanterar båda attributordningarna)
    const tokenMatch = html.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/i)
                    || html.match(/value="([^"]+)"[^>]*name="__RequestVerificationToken"/i);
    const token = tokenMatch ? tokenMatch[1] : null;

    // Extrahera cookies (måste skickas med POST för att CSRF ska fungera)
    const rawCookies = getRes.headers.getSetCookie?.() ?? [];
    const cookie     = rawCookies.map(c => c.split(";")[0]).join("; ");

    console.log("token:", token ? "✅" : "❌ saknas");
    console.log("cookie:", cookie || "(ingen)");

    // 2. POST med ALLA fält som formuläret skickar
    const body = new URLSearchParams();
    if (token) body.append("__RequestVerificationToken", token);
    body.append("OpenDoorFormData.FacilityNumber", FACILITY_ID);
    body.append("OpenDoorFormData.DoorId",         door.id);
    body.append("OpenDoorFormData.FacilityName",   "Hagastaden P-hus, mitt");
    body.append("OpenDoorFormData.RegNumber",       regnr);   // ← punkt, inte underscore

    const postRes = await fetch(BASE + POST_PATH, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Referer":      BASE + GET_PATH,
        "Origin":       BASE,
        "User-Agent":   "Mozilla/5.0",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body:   body.toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const text  = await postRes.text();
    const lower = text.toLowerCase();

    console.log("POST status:", postRes.status);
    console.log("POST svar:", text.substring(0, 300));

    if (!postRes.ok)
      return { status: 200, ok: false, msg: `Servern svarade med kod ${postRes.status}.` };

    if (lower.includes("ogiltigt") || lower.includes("invalid") ||
        lower.includes("inte registrerat") || lower.includes("not found") ||
        lower.includes("error"))
      return { status: 200, ok: false, msg: "Registreringsnumret verkar inte vara registrerat i systemet." };

    return { status: 200, ok: true, msg: `${door.name} öppnas! 🚗` };

  } catch (err) {
    console.error(err);
    if (err.name === "TimeoutError")
      return { status: 504, ok: false, msg: "Stockholm Parkering svarar inte. Försök igen." };
    return { status: 500, ok: false, msg: "Serverfel: " + err.message };
  }
}

module.exports = { openDoor };
