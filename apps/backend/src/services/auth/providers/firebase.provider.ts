import * as admin from 'firebase-admin';
import {
  AuthProvider,
  AuthProviderAbstract,
} from '@gitroom/backend/services/auth/providers.interface';

function ensureFirebaseApp() {
  if (admin.apps.length) {
    return admin.app();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are required'
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
    } catch {
      return false;
    }
  }
}
