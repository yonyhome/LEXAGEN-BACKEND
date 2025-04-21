// functions/src/routes/testBucket.ts
import * as functions from 'firebase-functions';
import { bucket } from '../firebase';

export const testBucket = functions.https.onRequest(async (req, res) => {
  try {
    const [files] = await bucket.getFiles({ maxResults: 1 });
    res.status(200).json({ message: 'Bucket accesible 🎉', files: files.map(f => f.name) });
  } catch (error) {
    console.error('[testBucket] Error:', error);
    res.status(500).json({ message: 'Bucket inaccesible 💥', error });
  }
});
