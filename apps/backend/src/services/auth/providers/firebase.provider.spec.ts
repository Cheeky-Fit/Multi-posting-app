jest.mock('firebase-admin', () => {
  const verifyIdToken = jest.fn();
  return {
    apps: [],
    initializeApp: jest.fn(),
    credential: { cert: jest.fn(() => ({})) },
    auth: () => ({ verifyIdToken }),
    __mock: { verifyIdToken },
  };
});

import * as admin from 'firebase-admin';
import { FirebaseProvider } from './firebase.provider';

describe('FirebaseProvider', () => {
  const provider = new FirebaseProvider();

  it('returns uid and email from a valid ID token', async () => {
    (admin as any).__mock.verifyIdToken.mockResolvedValue({
      uid: 'firebase-uid-1',
      email: 'seller@cheeky.test',
    });

    const user = await provider.getUser('fake-id-token');
    expect(user).toEqual({
      id: 'firebase-uid-1',
      email: 'seller@cheeky.test',
    });
  });

  it('returns false when token has no email', async () => {
    (admin as any).__mock.verifyIdToken.mockResolvedValue({
      uid: 'firebase-uid-2',
    });
    await expect(provider.getUser('tok')).resolves.toBe(false);
  });
});
