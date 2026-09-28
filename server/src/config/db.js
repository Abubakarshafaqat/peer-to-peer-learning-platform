import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDb() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });
  console.log(`MongoDB connected (${env.NODE_ENV})`);
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
