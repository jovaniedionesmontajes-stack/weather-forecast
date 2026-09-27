// Vercel serverless entry point. Every request to /api/* is rewritten to
// this function (see vercel.json), and the Express app below does its own
// internal routing based on req.url -- so all existing app.get/app.post
// routes in server/app.js work unchanged.
import { app } from '../server/app.js';

export default function handler(req, res) {
  return app(req, res);
}
