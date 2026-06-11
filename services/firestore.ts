import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  query,
  orderBy,
  limit,
  where,
  Timestamp,
  deleteDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { Report } from '../types';

const reportsCollection = (userId: string) =>
  collection(db, 'users', userId, 'reports');

function cleanUndefined(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(cleanUndefined);
  const clean: any = {};
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined) {
      clean[key] = cleanUndefined(obj[key]);
    }
  }
  return clean;
}

export async function saveReport(userId: string, report: Omit<Report, 'id'>): Promise<string> {
  const cleaned = cleanUndefined(report);
  const docRef = await addDoc(reportsCollection(userId), {
    ...cleaned,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function getReports(userId: string, limitCount = 50): Promise<Report[]> {
  const q = query(
    reportsCollection(userId),
    orderBy('createdAt', 'desc'),
    limit(limitCount),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    const createdAtVal = data.createdAt;
    const createdAtStr =
      createdAtVal && typeof createdAtVal.toDate === 'function'
        ? createdAtVal.toDate().toISOString()
        : typeof createdAtVal === 'string'
        ? createdAtVal
        : new Date().toISOString();

    return {
      id: d.id,
      ...(data as Omit<Report, 'id'>),
      createdAt: createdAtStr,
    };
  });
}

export async function getLatestReport(userId: string): Promise<Report | null> {
  const q = query(reportsCollection(userId), orderBy('createdAt', 'desc'), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data();
  const createdAtVal = data.createdAt;
  const createdAtStr =
    createdAtVal && typeof createdAtVal.toDate === 'function'
      ? createdAtVal.toDate().toISOString()
      : typeof createdAtVal === 'string'
      ? createdAtVal
      : new Date().toISOString();

  return {
    id: d.id,
    ...(data as Omit<Report, 'id'>),
    createdAt: createdAtStr,
  };
}

export async function deleteReport(userId: string, reportId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'reports', reportId));
}

export async function getReportById(userId: string, reportId: string): Promise<Report | null> {
  const snap = await getDoc(doc(db, 'users', userId, 'reports', reportId));
  if (!snap.exists()) return null;
  return {
    id: snap.id,
    ...(snap.data() as Omit<Report, 'id'>),
  };
}
