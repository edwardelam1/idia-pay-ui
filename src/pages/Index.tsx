import { useState, useEffect, useRef } from "react";
import { SplashScreen } from "@/components/SplashScreen";
import { ProvisioningScreen } from "@/components/ProvisioningScreen";
import { Dashboard } from "@/components/Dashboard";
import { ProvisioningEngine, PayAppBlueprint } from "@/lib/provisioning-engine";

// ============================================================================
// IDIA Sovereign Render Shell — Gatekeeper
// State 1: SplashScreen
// State 2: ProvisioningScreen (locked if no local blueprint)
// State 3: Dashboard hydrated from blueprint payload
// ============================================================================

const CONTEXT_ID = `Index.Gatekeeper.${Date.now()}`;
const STALL_THRESHOLD_MS = 8000;

const Index = () => {
  console.info(`[BEGIN: Index.Render] ContextID: ${CONTEXT_ID} | Boot sequence engaged.`);

  const [showSplash, setShowSplash] = useState(true);
  const [blueprint, setBlueprint] = useState<PayAppBlueprint | null>(null);
  const [hydrationChecked, setHydrationChecked] = useState(false);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Lifecycle 1: Cold-boot blueprint hydration check ---
  useEffect(() => {
    console.info(`[BEGIN: Index.HydrationCheck] ContextID: ${CONTEXT_ID} | Querying local sovereign blueprint cache.`);
    try {
      const cached = ProvisioningEngine.getLocalBlueprint();
      if (cached) {
        console.info(`[STATUS: Index.HydrationCheck] Blueprint discovered. Code: ${cached.provisioningCode}`);
        setBlueprint(cached);
      } else {
        console.info(`[STATUS: Index.HydrationCheck] No local blueprint. Gate will lock to ProvisioningScreen.`);
      }
      setHydrationChecked(true);
      console.info(`[END: Index.HydrationCheck] SUCCESS. ContextID: ${CONTEXT_ID}`);
    } catch (err) {
      console.error(
        `[END: Index.HydrationCheck] CRITICAL FAILURE. Offset: LocalCacheRead | ContextID: ${CONTEXT_ID} | Reason:`,
        err,
      );
      setHydrationChecked(true);
    }
  }, []);

  // --- Lifecycle 2: Silent-stall detector for the splash phase ---
  useEffect(() => {
    if (!showSplash) return;
    console.info(`[BEGIN: Index.StallDetector] Splash watchdog armed. Threshold: ${STALL_THRESHOLD_MS}ms`);
    stallTimerRef.current = setTimeout(() => {
      console.error(
        `[END: Index.StallDetector] CRITICAL FAILURE. Offset: SplashTransition | ContextID: ${CONTEXT_ID} | Reason: Splash exceeded ${STALL_THRESHOLD_MS}ms without onComplete. Forcing gate.`,
      );
      setShowSplash(false);
    }, STALL_THRESHOLD_MS);

    return () => {
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current);
        console.info(`[END: Index.StallDetector] SUCCESS. Watchdog disarmed.`);
      }
    };
  }, [showSplash]);

  // --- Transition Handlers ---
  const handleSplashComplete = () => {
    console.info(`[BEGIN: Index.handleSplashComplete] ContextID: ${CONTEXT_ID}`);
    setShowSplash(false);
    console.info(`[END: Index.handleSplashComplete] State transition Splash → Gate SUCCESS.`);
  };

  const handleHydrated = (bp: PayAppBlueprint) => {
    console.info(`[BEGIN: Index.handleHydrated] Blueprint received. Code: ${bp.provisioningCode}`);
    try {
      setBlueprint(bp);
      console.info(`[END: Index.handleHydrated] SUCCESS. Gate → Dashboard.`);
    } catch (err) {
      console.error(
        `[END: Index.handleHydrated] CRITICAL FAILURE. Offset: BlueprintCommit | ContextID: ${CONTEXT_ID} | Reason:`,
        err,
      );
    }
  };

  const handleWipeDevice = () => {
    console.info(`[BEGIN: Index.handleWipeDevice] ContextID: ${CONTEXT_ID}`);
    try {
      ProvisioningEngine.wipeDevice();
      setBlueprint(null);
      console.info(`[END: Index.handleWipeDevice] SUCCESS. Terminal de-provisioned.`);
    } catch (err) {
      console.error(
        `[END: Index.handleWipeDevice] CRITICAL FAILURE. Offset: WipeCallback | ContextID: ${CONTEXT_ID} | Reason:`,
        err,
      );
    }
  };

  // --- Gatekeeper State Machine ---
  if (showSplash) {
    console.info(`[STATE: Index.Gate] Rendering State 1 → SplashScreen`);
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  if (!hydrationChecked) {
    // Defensive: hydration check still in flight — render nothing rather than flash the wrong gate.
    console.info(`[STATE: Index.Gate] Hydration check pending — suspending render.`);
    return null;
  }

  if (!blueprint) {
    console.info(`[STATE: Index.Gate] Rendering State 2 → ProvisioningScreen (LOCKED — no blueprint)`);
    return <ProvisioningScreen onHydrated={handleHydrated} />;
  }

  console.info(
    `[STATE: Index.Gate] Rendering State 3 → Dashboard | Modules: ${
      blueprint.modules.default.length + blueprint.modules.custom.length
    }`,
  );
  return <Dashboard blueprint={blueprint} onWipeDevice={handleWipeDevice} />;
};

export default Index;
