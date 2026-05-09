import * as admin from 'firebase-admin';
import path from 'path';

try {
  // We use the JSON file directly since it is available
  const serviceAccountPath = path.resolve(__dirname, '../../firebase-service-account.json');
  
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath))
  });
  
  console.log('🔥 Firebase Admin initialized successfully.');
} catch (error) {
  console.error('Failed to initialize Firebase Admin:', error);
}

export default admin;
