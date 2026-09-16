import express from 'express';
import cors from 'cors';
import { initDb } from '../server/db';
import { controlPlaneRouter } from '../server/controlPlaneRoutes';
import { apiRouter } from '../server/routes';

initDb();

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'operational',
    service: 'WardenAI Zero-Trust Control Plane for Autonomous Agents',
    company: 'Creignificent LLC',
    enforcement_flow: 'Agent → WardenAI → Policy Decision → Human Review if Needed → Real Tool Execution → Audit Log',
    persistence: process.env.VERCEL ? 'ephemeral-/tmp' : 'local-file',
    timestamp: new Date().toISOString()
  });
});

app.use('/api', controlPlaneRouter);
app.use('/api', apiRouter);

export default app;
