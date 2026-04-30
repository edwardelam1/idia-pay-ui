import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Package, Lock } from "lucide-react";

interface IntegrationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Integrations are intentionally restricted on the IDIA Pay shell.
 * IDIA owns the full payments / accounting / messaging stack — third-party
 * connectors are not exposed by design.
 */
export const IntegrationsModal = ({ isOpen, onClose }: IntegrationsModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Integrations
          </DialogTitle>
          <DialogDescription>
            All payment, ledger, and communication services on this shell are powered natively by IDIA.
          </DialogDescription>
        </DialogHeader>

        <Card className="border-dashed">
          <CardContent className="p-2 md:p-3 md:p-4 flex items-start gap-3">
            <Lock className="h-5 w-5 mt-0.5 text-muted-foreground flex-shrink-0" />
            <div className="space-y-2 text-sm">
              <p className="font-medium">Sovereign stack — no external connectors</p>
              <p className="text-muted-foreground">
                External integrations are disabled by policy. Capabilities normally provided by third
                parties are delivered through IDIA's first-party modules instead.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
