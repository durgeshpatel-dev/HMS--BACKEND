import admin from '../config/firebase';

/**
 * Verifies a Firebase ID token and ensures the verified phone number matches the expected one.
 * @param idToken The Firebase ID Token sent from the frontend
 * @param expectedPhoneNumber The phone number (with country code, e.g., +919999999999) that should be verified
 * @returns boolean indicating success
 */
export async function verifyPhoneOtpToken(idToken: string, expectedPhoneNumber: string): Promise<boolean> {
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Check if the token's phone number matches the one we expect
    const verifiedPhone = decodedToken.phone_number;
    
    if (!verifiedPhone) {
      throw new Error('No phone number found in the verified token.');
    }

    // Normalize phone numbers to catch differences like missing '+'
    // Wait, let's just make sure the last 10 digits match to avoid strict formatting issues
    const normalizedExpected = expectedPhoneNumber.replace(/\D/g, '').slice(-10);
    const normalizedVerified = verifiedPhone.replace(/\D/g, '').slice(-10);

    if (normalizedExpected !== normalizedVerified) {
      throw new Error('Verified phone number does not match the provided phone number.');
    }

    return true;
  } catch (error: any) {
    throw new Error(`Firebase Token Verification Failed: ${error.message}`);
  }
}
