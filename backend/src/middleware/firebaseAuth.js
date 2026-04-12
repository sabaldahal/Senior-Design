const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

/**
 * Initialize Firebase Admin once. Use either:
 * - FIREBASE_SERVICE_ACCOUNT_PATH — absolute path or path relative to backend cwd (JSON key file)
 * - FIREBASE_SERVICE_ACCOUNT_JSON — single-line JSON string (e.g. for some hosts)
 */
function initFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return true;
  }

  const jsonPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const jsonRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  try {
    if (jsonPath) {
      const resolved = path.isAbsolute(jsonPath) ? jsonPath : path.resolve(process.cwd(), jsonPath);
      const cred = JSON.parse(fs.readFileSync(resolved, "utf8"));
      admin.initializeApp({ credential: admin.credential.cert(cred) });
      console.log("Firebase Admin initialized (service account file).");
      return true;
    }
    if (jsonRaw) {
      admin.initializeApp({ credential: admin.credential.cert(JSON.parse(jsonRaw)) });
      console.log("Firebase Admin initialized (service account JSON env).");
      return true;
    }
  } catch (err) {
    console.error("Firebase Admin init failed:", err.message);
    return false;
  }

  console.warn(
    "Firebase Admin not configured — set FIREBASE_SERVICE_ACCOUNT_PATH. /api/inventory, /api/dashboard, /api/alerts are not token-protected.",
  );
  return false;
}

async function requireFirebaseAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    return res.status(401).json({ message: "Unauthorized: sign in and send a Firebase ID token (Authorization: Bearer …)." });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(match[1]);
    req.user = { uid: decoded.uid, email: decoded.email || null };
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized: invalid or expired token." });
  }
}

module.exports = {
  initFirebaseAdmin,
  requireFirebaseAuth,
};
