const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const BASE      = "https://portal2.stockholmparkering.se";
const GET_PATH  = "/passage?anlaggningsId=105243&dorrId=121500";

app.post("/api/open", async (req, res) => {
  const regnr = (req.body.regnr || "").toUpperCase().replace(/\s/g, "");
  if (!regnr) return res.json({ ok: false, msg: "Registreringsnummer saknas." });

  try {
    // 1. GET – hämta CSRF-token och session-cookie
    const getRes = await fetch(BASE + GET_PATH, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
    });
    const html = await getRes.text();

    const tokenMatch = html.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/);
    const token      = tokenMatch ? tokenMatch[1] : null;

    const dataUrlMatch = html.match(/id="openDoorForm"[^>]*data-url="([^"]+)"/);
    const postPath     = dataUrlMatch ? dataUrlMatch[1] : GET_PATH;

    const rawCookies = getRes.headers.getSetCookie?.() ?? [];
    const cookie     = rawCookies.map(c => c.split(";")[0]).join("; ");

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

    if (!postRes.ok)
      return res.json({ ok: false, msg: `Fel från servern (${postRes.status}).` });

    if (lower.includes("ogiltigt") || lower.includes("invalid") || lower.includes("error"))
      return res.json({ ok: false, msg: "Registreringsnumret verkar inte vara registrerat." });

    res.json({ ok: true, msg: "Dörren öppnas! 🚗" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, msg: "Serverfel: " + err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("✅  http://localhost:" + PORT));
