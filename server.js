// Lokal server (och Render). På Vercel används api/open.js i stället.
const express = require("express");
const path = require("path");
const { openDoor } = require("./lib/openDoor");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/open", async (req, res) => {
  const { status, ok, msg } = await openDoor(req.body.regnr, req.body.doorId);
  res.status(status).json({ ok, msg });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("✅  http://localhost:" + PORT));
