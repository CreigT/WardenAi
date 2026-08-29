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

async function startServer() {
  // Initialize persistence layer and seed data
  initDb();

  const app = express();
  const PORT = 3000;

  // Global Middleware
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Security Headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'operational',
      service: 'WardenAi Autonomous AI-Agent Security Control Plane',
      company: 'Creignificent LLC',
      timestamp: new Date().toISOString()
    });
  });

  // API Routes
  app.use('/api', apiRouter);

  // Vite Middleware in Development / Static Files in Production
  if (process.env.NODE_ENV !== 'production') {
    console.log('⚡ [WardenAi Server] Mounting Vite Dev Server middleware');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    console.log('🚀 [WardenAi Server] Serving Production static bundle from dist');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🛡️ [Warden Control Plane] Active and listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('❌ Fatal error starting Warden server:', err);
  process.exit(1);
});
