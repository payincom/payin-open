import { AlertTriangle, ShieldCheck } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Button } from "./ui/button";

export interface SecurityWarningProps {
  mode: "web" | "extension";
  extensionDownloadUrl?: string;
  className?: string;
}

export function SecurityWarning({
  mode,
  extensionDownloadUrl,
  className,
}: SecurityWarningProps) {
  if (mode === "extension") {
    return (
      <Alert className={className}>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Production Environment</AlertTitle>
        <AlertDescription>
          You are running the secure browser extension with full functionality.
          Addresses generated here can be used in production operations.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive" className={className}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Test Mode Only</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>
          The web version is restricted for security reasons. Mnemonic import,
          custom derivation paths, and address verification are disabled. Do not
          use addresses generated here for real funds.
        </p>
        {extensionDownloadUrl ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              if (
                extensionDownloadUrl &&
                typeof window !== "undefined" &&
                window?.open
              ) {
                window.open(extensionDownloadUrl, "_blank", "noopener");
              }
            }}
          >
            Install Secure Extension
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
