import http from 'http';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';
import { initSocket } from './services/socket.js';
import { Alert } from './models/Alert.js';
import { User } from './models/User.js';

async function main() {
  await connectDB();
  await Promise.all([Alert.init(), User.init()]); // make sure indexes (incl. the one-open-alert rule) exist

  const server = http.createServer(createApp());
  initSocket(server);
  server.listen(env.port, () => console.log(`Silent SOS API listening on port ${env.port}`));

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
