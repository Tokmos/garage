// Vercel-funktion: POST /api/open
const { openDoor } = require("../lib/openDoor");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ ok: false, msg: "Endast POST." });

  const { status, ok, msg } = await openDoor(req.body?.regnr);
  res.status(status).json({ ok, msg });
};
