import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  throw new Error('MONGODB_URI environment variable is required');
}

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectDatabase(): Promise<Db> {
  if (db) {
    return db;
  }

  if (!mongoUri) {
    throw new Error('MONGODB_URI environment variable is required');
  }

  try {
    client = new MongoClient(mongoUri);
    await client.connect();
    db = client.db('inkgenius');
    console.log('✅ Connected to MongoDB');
    return db;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('MongoDB connection closed');
  }
}

export async function getDatabase(): Promise<Db> {
  if (!db) {
    return await connectDatabase();
  }
  return db;
}
