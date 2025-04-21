import * as admin from 'firebase-admin';
import { getApps, initializeApp} from 'firebase-admin/app';


if (!getApps().length) {
  initializeApp({
    storageBucket: "lexagen-e6d7f.appspot.com",
  });
}

export const db = admin.firestore();
export const bucket = admin.storage().bucket();
export { admin };
