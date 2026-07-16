import * as admin from 'firebase-admin';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import {
  AuthProvider,
  AuthProviderAbstract,
} from '@gitroom/backend/services/auth/providers.interface';

function ensureFirebaseApp() {
  if (admin.apps.length) {
    return admin.app();
  }

  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (serviceAccountPath) {
    const absolutePath = resolve(process.cwd(), serviceAccountPath);
    if (!existsSync(absolutePath)) {
      throw new Error(
        `Firebase service account file not found: ${absolutePath}`
      );
    }
    const serviceAccount = JSON.parse(readFileSync(absolutePath, 'utf8'));
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId:
        serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID,
    });
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_PATH to a service-account JSON file, or set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY'
    );
  }

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

@AuthProvider({ provider: 'FIREBASE' })
export class FirebaseProvider extends AuthProviderAbstract {
  generateLink() {
    // Client-side Firebase Google popup; no server authorize URL.
    return '';
  }

  async getToken() {
    // Frontend already sends the ID token as providerToken.
    return '';
  }

  // @ts-expect-error AuthProviderAbstract union type does not model async false
  async getUser(providerToken: string) {
    try {
      ensureFirebaseApp();
      const decoded = await admin.auth().verifyIdToken(providerToken);
      if (!decoded?.uid || !decoded?.email) {
        return false;
      }
      return { id: decoded.uid, email: decoded.email.toLowerCase() };
    } catch (err) {
      console.error('[FirebaseProvider] ID token verification failed:', err);
      return false;
    }
  }
}
