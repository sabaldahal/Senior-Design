function requireApiKey(req, res, next) {
  const configuredKey = process.env.API_KEY;
  if (!configuredKey) {
    return next();
  }

  const incomingKey = req.header("x-api-key");
  if (!incomingKey || incomingKey !== configuredKey) {
    return res.status(401).json({ message: "Unauthorized: invalid API key" });
  }

  return next();
}

module.exports = { requireApiKey };
