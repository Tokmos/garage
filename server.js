const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const BASE      = "https://portal2.stockholmparkering.se";
const GET_PATH  = "/passage?anlaggningsId=105243&dorrId=121500";

// Hjälp: extrahera ett attributvärde oavsett attributordning
function attr(html, attrName) {
  const re = new RegExp(`${attrName}="([^"]+)"`, "i");
  const m  = html.match(re);
  return m ? m[1] : null;
}

// Debug-endpoint – visar vad servern ser på Stockholm Parkeringsidan
app.get("/api/debug", async (req, res) => {
  try {
    const getRes = await fetch(BASE + GET_PATH, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
    });
    const html = await getRes.text();

    // Extrahera formulärblocket
    const formMatch = html.match(/<form[^>]*id="openDoorForm"[^>]*>[\s\S]*?<\/form>/i)
                   || html.match(/<form[\s\S]*?<\/form>/i);
    const formHtml = formMatch ? formMatch[0] : "(form hittades inte)";

    // Hitta alla input-fält
    const inputs = [...html.matchAll(/<input[^>]*>/gi)].map(m => m[0]);

    const rawCookies = getRes.headers.getSetCookie?.() ?? [];

    res.json({
      status:       getRes.status,
      cookies:      rawCookies,
      token:        attr(html, "__RequestVerificationToken") || attr(html, "value"),
      formHtml,
      inputs,
      // Skicka med 2000 tecken av HTML:en för manuell inspektion
      htmlSnippet:  html.substring(0, 2000),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/open", async (req, res) => {
  const regnr = (req.body.regnr || "").toUpperCase().replace(/\s/g, "");
  if (!regnr) return res.json({ ok: false, msg: "Registreringsnummer saknas." });

  try {
    // 1. GET – hämta CSRF-token och session-cookie
    const getRes = await fetch(BASE + GET_PATH, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
    });
    const html = await getRes.text();

    // CSRF-token – hantera båda attributordningarna
    const tokenMatch = html.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/i)
                    || html.match(/value="([^"]+)"[^>]*name="__RequestVerificationToken"/i);
    const token = tokenMatch ? tokenMatch[1] : null;

    // data-url från formuläret – hantera båda ordningarna
    const dataUrlMatch = html.match(/id="openDoorForm"[^>]*data-url="([^"]+)"/i)
                      || html.match(/data-url="([^"]+)"[^>]*id="openDoorForm"/i);
    const postPath = dataUrlMatch ? dataUrlMatch[1] : GET_PATH;

    // Cookies
    const rawCookies = getRes.headers.getSetCookie?.() ?? [];
    const cookie     = rawCookies.map(c => c.split(";")[0]).join("; ");

    // Logga vad vi hittade
    console.log("token:", token ? "✅ hittad" : "❌ saknas");
    console.log("postPath:", postPath);
    console.log("cookie:", cookie || "(ingen)");

    // 2. POST – öppna dörren
    const body = new URLSearchParams({ OpenDoorFormData_RegNumber: regnr });
    if (token) body.append("__RequestVerificationToken", token);

    const postUrl = postPath.startsWith("http") ? postPath : BASE + postPath;

    const postRes = await fetch(postUrl, {
      method:  "POST",
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
    console.log("POST svar (500 tecken):", text.substring(0, 500));

    if (!postRes.ok)
      return res.json({ ok: false, msg: `Servern svarade med kod ${postRes.status}. Kontrollera att registreringsnumret är registrerat.` });

    if (lower.includes("ogiltigt") || lower.includes("invalid") || lower.includes("inte registrerat") || lower.includes("not found"))
      return res.json({ ok: false, msg: "Registreringsnumret verkar inte vara registrerat i systemet." });

    res.json({ ok: true, msg: "Dörren öppnas! 🚗" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, msg: "Serverfel: " + err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("✅  http://localhost:" + PORT));
