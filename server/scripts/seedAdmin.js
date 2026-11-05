import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { connectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';

async function run() {
  const { name, email, password } = env.admin;
  if (!email || password.length < 8) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (8+ characters) in server/.env first.');
    process.exit(1);
  }
  await connectDB();
  const existing = await User.findOne({ email });
  if (existing) {
    existing.role = 'admin';
    await existing.save();
    console.log(`Existing account ${email} is now an admin.`);
  } else {
    await User.create({ name, email, role: 'admin', passwordHash: await User.hash(password) });
    console.log(`Admin account created: ${email}`);
  }
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
