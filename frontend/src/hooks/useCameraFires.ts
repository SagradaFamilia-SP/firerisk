import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { apiClient, getErrorMessage } from '../services/api';
import type { CameraFireDetection } from '../types/api';
import type { AsyncState } from './useDashboard';

const POLL_INTERVAL_MS = 20_000;
const SEEN_IDS_STORAGE_KEY = 'ignis:seen-camera-fires';

function loadSeenIds(): Set<number> {
  try {
    const raw = window.localStorage.getItem(SEEN_IDS_STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as number[]) : []);
  } catch {
    return new Set();
  }
}

function saveSeenIds(ids: Set<number>) {
  try {
    window.localStorage.setItem(SEEN_IDS_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // A private-window/blocked-storage failure just means we'll re-notify
    // next load — acceptable, not worth surfacing to the user.
  }
}

/**
 * Polls camera-detected fires (YOLO over a live Vonage stream, as opposed to
 * NASA FIRMS satellite detections) and tracks which ones are new since the
 * last visit, so the map can surface a one-time "new fire detected" notice
 * instead of re-announcing the same detection on every reload.
 */
export function useCameraFires() {
  const [state, setState] = useState<AsyncState<CameraFireDetection[]>>({ status: 'idle', data: null, error: null });
  const [notification, setNotification] = useState<CameraFireDetection | null>(null);
  const seenIdsRef = useRef<Set<number>>(loadSeenIds());
  // The mount-time fetch, the 20s poll and the postMessage-triggered refetch
  // each call `refresh()` independently — without tracking which call is the
  // *latest*, a slow-to-resolve older request (e.g. after a transient 502)
  // can win the race and overwrite a newer response, silently reverting the
  // notification back to an already-seen fire right after a fresh one showed.
  const latestControllerRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    latestControllerRef.current?.abort();
    const controller = new AbortController();
    latestControllerRef.current = controller;
    setState((current) => ({ status: 'loading', data: current.data, error: null }));
    apiClient.cameraFires(controller.signal).then(
      (data) => {
        if (latestControllerRef.current !== controller) return; // superseded by a newer refresh
        setState({ status: 'success', data, error: null });
        const unseen = data.find((fire) => !seenIdsRef.current.has(fire.id));
        // TEMPORARY diagnostic trace — remove once the "no veo la notificación"
        // report is confirmed fixed. Open DevTools console to see this.
        console.log('[camera-notice] refresh resolved', {
          ids: data.map((fire) => fire.id),
          seenIds: [...seenIdsRef.current],
          unseenId: unseen?.id ?? null,
        });
        if (unseen) setNotification(unseen);
      },
      (error: unknown) => {
        if ((error as Error).name !== 'AbortError') {
          setState((current) => ({ status: 'error', data: current.data, error: getErrorMessage(error) }));
        }
      },
    );
    return controller;
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      latestControllerRef.current?.abort();
      window.clearInterval(timer);
    };
  }, [refresh]);

  // A camera page (a separate static iframe) posts these the instant YOLO
  // flags a fire, and again once that fire's clip finishes uploading a few
  // seconds later, so the marker/notification and the recording playback
  // show up without waiting for the next poll tick.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const type = (event.data as { type?: string } | null)?.type;
      // TEMPORARY diagnostic trace — remove once confirmed fixed.
      if (type?.startsWith('camera-fire')) console.log('[camera-notice] message received', type);
      if (type === 'camera-fire-detected' || type === 'camera-fire-recording-saved') refresh();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [refresh]);

  // Takes an optional id so a click elsewhere (e.g. "Ver en mapa" on an
  // older, already-listed detection) can't silently swallow a *different*,
  // still-unseen notification that happens to be showing at that moment —
  // only the close button (which has no target id) dismisses whatever's
  // currently displayed.
  const dismissNotification = useCallback((id?: number) => {
    setNotification((current) => {
      if (!current || (typeof id === 'number' && current.id !== id)) return current;
      seenIdsRef.current.add(current.id);
      saveSeenIds(seenIdsRef.current);
      return null;
    });
  }, []);

  return useMemo(() => ({
    fires: state.data ?? [], status: state.status, error: state.error, notification, dismissNotification,
  }), [state, notification, dismissNotification]);
}

export type CameraFires = ReturnType<typeof useCameraFires>;
