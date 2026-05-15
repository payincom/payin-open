import * as React from "react";
import type { Protocol } from "@payin/wallet-core";

import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { ProtocolBadge } from "./ProtocolBadge";
import { cn } from "../lib/utils";

export interface ProtocolSelectorProps {
  value: Protocol;
  onChange: (protocol: Protocol) => void;
  disabled?: boolean;
  className?: string;
}

const protocols: { value: Protocol; label: string; description: string }[] = [
  { value: "evm", label: "EVM", description: "Ethereum, Polygon, Base, BSC" },
  { value: "tron", label: "Tron", description: "Tron Mainnet & Nile Testnet" },
  { value: "solana", label: "Solana", description: "Solana Mainnet" },
];

export function ProtocolSelector({
  value,
  onChange,
  disabled,
  className,
}: ProtocolSelectorProps) {
  const handleChange = React.useCallback(
    (nextValue: string) => {
      if (!disabled) {
        onChange(nextValue as Protocol);
      }
    },
    [disabled, onChange]
  );

  return (
    <div className={cn("space-y-3", className)}>
      <Label>Blockchain Protocol</Label>
      <RadioGroup
        value={value}
        onValueChange={handleChange}
        className="grid gap-3 md:grid-cols-3"
      >
        {protocols.map((protocolItem) => {
          const isActive = protocolItem.value === value;

          return (
            <Label
              key={protocolItem.value}
              htmlFor={`protocol-${protocolItem.value}`}
              className={cn(
                "group relative flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition",
                "hover:border-primary hover:bg-primary/5",
                disabled && "cursor-not-allowed opacity-50",
                isActive && "border-primary bg-primary/5 shadow-sm"
              )}
            >
              <RadioGroupItem
                id={`protocol-${protocolItem.value}`}
                value={protocolItem.value}
                disabled={disabled}
                className="mt-1"
              />
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">
                    {protocolItem.label}
                  </span>
                  <ProtocolBadge protocol={protocolItem.value} />
                </div>
                <span className="text-xs text-muted-foreground">
                  {protocolItem.description}
                </span>
              </div>
            </Label>
          );
        })}
      </RadioGroup>
    </div>
  );
}
