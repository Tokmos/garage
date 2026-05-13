const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const BASE     = "https://portal2.stockholmparkering.se";
const GET_PATH = "/passage?anlaggningsId=105243&dorrId=121500";
const POST_PATH = "/passage/OpenDoor";

app.post("/api/open", async (req, res) => {
  const regnr = (req.body.regnr || "").toUpperCase().replace(/\s/g, "");
  if (!regnr) return res.json({ ok: false, msg: "Registreringsnummer saknas." });

  try {
    // 1. GET – hämta CSRF-token och session-cookie
    const getRes = await fetch(BASE + GET_PATH, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
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
    body.append("OpenDoorFormData.FacilityNumber", "105243");
    body.append("OpenDoorFormData.DoorId",         "121500");
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
      body: body.toString(),
    });

    const text  = await postRes.text();
    const lower = text.toLowerCase();

    console.log("POST status:", postRes.status);
    console.log("POST svar:", text.substring(0, 300));

    if (!postRes.ok)
      return res.json({ ok: false, msg: `Servern svarade med kod ${postRes.status}.` });

    if (lower.includes("ogiltigt") || lower.includes("invalid") ||
        lower.includes("inte registrerat") || lower.includes("not found") ||
        lower.includes("error"))
      return res.json({ ok: false, msg: "Registreringsnumret verkar inte vara registrerat i systemet." });

    res.json({ ok: true, msg: "Dörren öppnas! 🚗" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, msg: "Serverfel: " + err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("✅  http://localhost:" + PORT));
