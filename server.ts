/**
 * WardenAi Main Server Entry Point
 * Express API Gateway + Vite Frontend Integration
 * Creignificent LLC
 */

import express from 'express';
import path from 'path';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { initDb } from './server/db';
import { apiRouter } from './server/routes';
import { controlPlaneRouter } from './server/controlPlaneRoutes';
import { opsGuardRouter } from './server/opsGuardRoutes';
import { hybridCryptoRouter } from './server/hybridCryptoRoutes';

async function startServer() {
  initDb();
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });
  app.get('/api/health', (req, res) => res.json({ status: 'operational', service: 'WardenAI Zero-Trust Control Plane for Autonomous Agents', company: 'Creignificent LLC', enforcement_flow: 'Agent → WardenAI → Policy Decision → Human Review if Needed → Real Tool Execution → Audit Log', hybrid_crypto: process.env.WARDEN_HYBRID_CRYPTO_ENABLED === 'true' ? 'enabled' : 'disabled', timestamp: new Date().toISOString() }));
  app.use('/api', opsGuardRouter);
  app.use('/api', hybridCryptoRouter);
  app.use('/api', controlPlaneRouter);
  app.use('/api', apiRouter);
  if (process.env.NODE_ENV !== 'production') {
    console.log('⚡ [WardenAI Server] Mounting Vite Dev Server middleware');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' }); app.use(vite.middlewares);
  } else {
    console.log('🚀 [WardenAI Server] Serving Production static bundle from dist');
    const distPath = path.join(process.cwd(), 'dist'); app.use(express.static(distPath)); app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`🛡️ [WardenAI Control Plane] Active and listening on http://0.0.0.0:${PORT}`));
}
startServer().catch(err => { console.error('❌ Fatal error starting WardenAI server:', err); process.exit(1); });
