import { supabase } from "@/integrations/supabase/client";

// Updated to include all telemetry tags used in the Dashboard
export type FinancialEventType =
  | "TENDER_INITIATED"
  | "TENDER_FINALIZED"
  | "ITEM_ADDED"
  | "ITEM_VOIDED"
  | "SHIFT_STARTED"
  | "SHIFT_ENDED"
  | "FEATURE_ACCESSED";

const DB_NAME = "IDIA_PAY_EDGE_BUS";
const STORE_NAME = "offline_events";

/**
 * Self-healing IDB open: if the existing DB is missing the required object
 * store, bump the version once to trigger onupgradeneeded and create it.
 */
const openBufferDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const probe = indexedDB.open(DB_NAME);
    probe.onerror = () => reject(probe.error);
    probe.onsuccess = () => {
      const db = probe.result;
      if (db.objectStoreNames.contains(STORE_NAME)) {
        resolve(db);
        return;
      }
      const nextVersion = db.version + 1;
      db.close();
      const upgrade = indexedDB.open(DB_NAME, nextVersion);
      upgrade.onupgradeneeded = () => {
        const udb = upgrade.result;
        if (!udb.objectStoreNames.contains(STORE_NAME)) {
          udb.createObjectStore(STORE_NAME, { keyPath: "correlation_id" });
        }
      };
      upgrade.onsuccess = () => resolve(upgrade.result);
      upgrade.onerror = () => reject(upgrade.error);
    };
  });
};

export const useEventPublisher = () => {
  const emitEvent = async (type: FinancialEventType, payload: any, correlationId: string) => {
    console.info(`[BEGIN: EventPublisher.Emit] Type: ${type} | Beacon: ${correlationId}`);

    const eventBody = {
      event_type: type,
      payload: payload,
      correlation_id: correlationId,
      created_at: new Date().toISOString(),
      status: "PENDING_ANCHOR",
    };

    try {
      if (navigator.onLine) {
        const { error } = await supabase.from("financial_event_log" as any).insert([eventBody]);
        if (error) throw error;
        console.info("[END: EventPublisher.LivePush] Success.");
      } else {
        console.warn("[WARNING: WAN_FAILURE] Pivoting to Native Edge Buffer.");
        try {
          await bufferEventLocally(eventBody);
        } catch (bufErr) {
          console.warn("[WARNING: EventPublisher.Buffer] Native buffer unavailable:", bufErr);
        }
      }
    } catch (err) {
      console.warn(
        `[NON-CRITICAL: EventPublisher.Emit] Live push failed; attempting native buffer. Reason:`,
        err,
      );
      try {
        await bufferEventLocally(eventBody);
      } catch (bufErr) {
        // Buffer failures must NEVER bubble out of emitEvent — telemetry is best-effort.
        console.warn("[WARNING: EventPublisher.Buffer] Native buffer unavailable:", bufErr);
      }
    } finally {
      console.info("[END: EventPublisher.Emit] Sequence finalized.");
    }
  };

  const bufferEventLocally = async (event: any): Promise<void> => {
    const db = await openBufferDB();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const addRequest = store.put({ ...event, status: "OFFLINE_QUEUED" });
        addRequest.onsuccess = () => {
          console.info(`[END: EdgeResilience.NativeBuffer] Success. Beacon: ${event.correlation_id}`);
          resolve();
        };
        addRequest.onerror = () => reject(addRequest.error);
      } catch (e) {
        reject(e);
      }
    });
  };

  return { emitEvent };
};
