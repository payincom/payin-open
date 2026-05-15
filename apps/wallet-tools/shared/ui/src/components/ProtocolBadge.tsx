import { Badge, type BadgeProps } from "./ui/badge";
import type { Protocol } from "@payin/wallet-core";
import { cn } from "../lib/utils";

const protocolStyles: Record<Protocol, string> = {
  evm: "bg-emerald-600/10 text-emerald-600 border-emerald-600/30",
  tron: "bg-red-600/10 text-red-600 border-red-600/30",
  solana: "bg-purple-600/10 text-purple-500 border-purple-500/30",
};

export interface ProtocolBadgeProps extends BadgeProps {
  protocol: Protocol;
  className?: string;
}

export function ProtocolBadge({
  protocol,
  className,
  variant = "outline",
  ...props
}: ProtocolBadgeProps) {
  return (
    <Badge
      variant={variant}
      className={cn("uppercase tracking-wide", protocolStyles[protocol], className)}
      {...props}
    >
      {protocol}
    </Badge>
  );
}
