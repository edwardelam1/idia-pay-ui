import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useReconnectionSyncer = () => {
  useEffect(() => {
    console.info("[BEGIN: ReconnectionSyncer.Init] Activating native sentinel.");

    const processOfflineQueue = () => {
      console.info("[BEGIN: ReconnectionSyncer.SyncProcess] Connectivity detected.");

      const probe = indexedDB.open("IDIA_PAY_EDGE_BUS");
      probe.onerror = () => {
        // No DB yet — nothing to sync. Silent no-op.
      };
      probe.onsuccess = () => {
        const db = probe.result;
        if (!db.objectStoreNames.contains("offline_events")) {
          // Schema not yet provisioned by the publisher — nothing buffered.
          db.close();
          return;
        }

        let tx: IDBTransaction;
        try {
          tx = db.transaction("offline_events", "readwrite");
        } catch {
          db.close();
          return;
        }
        const store = tx.objectStore("offline_events");
        const getAllRequest = store.getAll();

        getAllRequest.onsuccess = async () => {
          const events = getAllRequest.result;
          if (events.length === 0) return;

          console.info(`[STATUS: Sync] Found ${events.length} queued events.`);

          for (const event of events) {
            console.info(`[BEGIN: EventSync.Push] Beacon: ${event.correlation_id}`);
            const { error } = await supabase
              .from("financial_event_log" as any)
              .insert([{ ...event, status: "COMPILED" }]);

            if (!error) {
              try {
                db.transaction("offline_events", "readwrite")
                  .objectStore("offline_events")
                  .delete(event.correlation_id);
                console.info(`[END: EventSync.Push] Anchored.`);
              } catch (delErr) {
                console.warn(`[WARN: EventSync.Delete] ${delErr}`);
              }
            } else {
              console.warn(`[NON-CRITICAL: EventSync.Push] ${error.message}`);
              break;
            }
          }
        };
      };
    };

    window.addEventListener("online", processOfflineQueue);
    if (navigator.onLine) processOfflineQueue();

    return () => window.removeEventListener("online", processOfflineQueue);
  }, []);
};
