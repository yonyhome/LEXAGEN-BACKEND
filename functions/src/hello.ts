import { https } from 'firebase-functions';

export const hello = https.onRequest((req, res) => {
  res.send("Hello from LexaGen!");
});
