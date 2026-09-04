import { MongooseModuleOptions } from '@nestjs/mongoose';

/**
 * Validate the connection string before Mongoose starts retrying. The message is safe to
 * expose in startup logs: it never includes the supplied URI or credentials.
 */
export function requireMongoUri(value?: string): string {
  const uri = value?.trim();
  if (!uri) {
    throw new Error('MONGO_URI must be configured');
  }

  try {
    const parsed = new URL(uri);
    if (
      (parsed.protocol !== 'mongodb:' && parsed.protocol !== 'mongodb+srv:') ||
      !parsed.hostname
    ) {
      throw new Error('unsupported MongoDB URI');
    }
  } catch {
    throw new Error('MONGO_URI must be a valid mongodb:// or mongodb+srv:// URI');
  }

  return uri;
}

export function mongoModuleOptions(uri?: string): MongooseModuleOptions {
  return { uri: requireMongoUri(uri) };
}
