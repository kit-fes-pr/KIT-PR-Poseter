import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage: node --env-file=.env scripts/create-admin.mjs <email> <password>');
  process.exit(1);
}

if (!email.endsWith('@st.kanazawa-it.ac.jp')) {
  console.error('st.kanazawa-it.ac.jp ドメインのメールアドレスのみ使用可能です');
  process.exit(1);
}

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error('FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY が必要です');
  process.exit(1);
}

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    });

const adminAuth = getAuth(app);
const adminDb = getFirestore(app);

(async () => {
  const displayName = email.split('@')[0];

  let userRecord;
  let operation;
  try {
    const existingUser = await adminAuth.getUserByEmail(email);
    userRecord = await adminAuth.updateUser(existingUser.uid, {
      password,
      displayName,
      emailVerified: true,
      disabled: false,
    });
    operation = 'updated';
  } catch (error) {
    const firebaseError = error;
    if (firebaseError?.code === 'auth/user-not-found') {
      userRecord = await adminAuth.createUser({
        email,
        password,
        displayName,
        emailVerified: true,
        disabled: false,
      });
      operation = 'created';
    } else {
      throw error;
    }
  }

  await adminAuth.setCustomUserClaims(userRecord.uid, {
    role: 'admin',
    isAdmin: true,
  });

  const adminDoc = await adminDb.collection('admins').doc(userRecord.uid).get();
  if (!adminDoc.exists) {
    await adminDb.collection('admins').doc(userRecord.uid).set({
      adminId: userRecord.uid,
      email: userRecord.email,
      name: userRecord.displayName || displayName,
      isActive: true,
      createdAt: new Date(),
    });
  }

  const customToken = await adminAuth.createCustomToken(userRecord.uid, {
    role: 'admin',
    isAdmin: true,
  });

  console.log(JSON.stringify({
    success: true,
    operation,
    user: {
      uid: userRecord.uid,
      email: userRecord.email,
      name: userRecord.displayName || displayName,
      isAdmin: true,
    },
    customToken,
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
