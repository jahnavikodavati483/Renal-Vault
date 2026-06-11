import { useState, useEffect } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { Report } from '../types';

function toISOString(val: any): string {
  if (val && typeof val.toDate === 'function') return val.toDate().toISOString();
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

function docToReport(d: any): Report {
  const data = d.data();
  return {
    id: d.id,
    ...data,
    createdAt: toISOString(data.createdAt),
    date: toISOString(data.date),
  } as Report;
}

interface UseReportsState {
  reports: Report[];
  latestReport: Report | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useReports(userId: string | undefined): UseReportsState {
  const [reports, setReports]           = useState<Report[]>([]);
  const [latestReport, setLatestReport] = useState<Report | null>(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setReports([]);
      setLatestReport(null);
      return;
    }

    setLoading(true);

    const q = query(
      collection(db, 'users', userId, 'reports'),
      orderBy('createdAt', 'desc'),
      limit(50),
    );

    // Real-time listener — updates instantly whenever a report is saved
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const fetched = snap.docs.map(docToReport);
        setReports(fetched);
        setLatestReport(fetched[0] ?? null);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[useReports] Firestore error:', err);
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [userId]);

  // refresh() is kept for pull-to-refresh UI compatibility
  // With onSnapshot the data is always live, so this is a no-op
  const refresh = () => {};

  return { reports, latestReport, loading, error, refresh };
}
