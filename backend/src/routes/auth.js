const express = require("express");

const router = express.Router();

router.post("/login", (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "").trim();

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required." });
  }

  // Minimal auth for MVP/demo. Replace with real user auth later.
  const token = Buffer.from(`${username}:${Date.now()}`).toString("base64");
  return res.json({
    token,
    user: { username }
  });
});

router.post("/logout", (_req, res) => {
  return res.json({ ok: true });
});

module.exports = router;
