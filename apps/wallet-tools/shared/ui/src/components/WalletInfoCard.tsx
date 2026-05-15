import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Badge } from "./ui/badge";
import { CopyButton } from "./CopyButton";
import { cn } from "../lib/utils";
import type { WalletInfo } from "@payin/wallet-core";

export interface WalletInfoCardProps {
  walletInfo: WalletInfo;
  onCopy?: () => void;
  className?: string;
  title?: string;
  description?: string;
}

export function WalletInfoCard({
  walletInfo,
  onCopy,
  className,
  title = "Wallet Information",
  description = "Master public key derived from the mnemonic",
}: WalletInfoCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant="outline" className="uppercase tracking-wide">
            {walletInfo.protocol}
          </Badge>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            Master Public Key
          </p>
          <div className="rounded-md border bg-muted/30 p-3 font-mono text-sm break-all">
            {walletInfo.masterPublicKey}
          </div>
        </div>
        <CopyButton
          value={walletInfo.masterPublicKey}
          label="Copy Master Key"
          onCopy={onCopy}
          className={cn("w-full sm:w-auto")}
        />
      </CardContent>
    </Card>
  );
}
