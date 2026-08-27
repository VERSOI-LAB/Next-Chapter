const express = require('express');

const router = express.Router();

// Public runtime config for the frontend. toss_client_key is a publishable
// key by design (Toss's own docs embed it in client-side JS), so it is safe
// to expose here.
router.get('/', (req, res) => {
  res.json({ toss_client_key: process.env.TOSS_CLIENT_KEY || null });
});

module.exports = router;
