import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { FirebaseApp } from 'firebase/app';
import app from './firebase';

const typedApp = app as FirebaseApp;

// Storage requires Firebase Blaze (pay-as-you-go) plan.
// On Spark (free) plan, uploads are silently skipped — reports still save to Firestore.
function getStorageInstance() {
  try {
    return getStorage(typedApp);
  } catch {
    return null;
  }
}

export async function uploadReportImage(
  userId: string,
  localUri: string,
  reportId: string,
): Promise<string | null> {
  const storage = getStorageInstance();
  if (!storage) return null;

  try {
    const response = await fetch(localUri);
    const blob = await response.blob();
    const storageRef = ref(storage, `reports/${userId}/${reportId}.jpg`);
    await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
    return getDownloadURL(storageRef);
  } catch {
    // Returns null on Spark plan or network error — non-critical
    return null;
  }
}

export async function deleteReportImage(userId: string, reportId: string): Promise<void> {
  const storage = getStorageInstance();
  if (!storage) return;
  try {
    await deleteObject(ref(storage, `reports/${userId}/${reportId}.jpg`));
  } catch {
    // Ignore if file doesn't exist
  }
}
