import { Button, type ButtonProps } from "./ui/button";
import type { AddressData, Protocol } from "@payin/wallet-core";

export type CSVAddressRecord = AddressData & {
  path?: string;
  privateKey?: string;
};

function escapeCsvValue(value: string | number | undefined | null): string {
  if (value === undefined || value === null) {
    return "";
  }

  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

export interface CSVExporterProps extends Omit<ButtonProps, "children"> {
  addresses: CSVAddressRecord[];
  protocol: Protocol;
  filename?: string;
  includePrivateKeys?: boolean;
}

export function CSVExporter({
  addresses,
  protocol,
  filename,
  includePrivateKeys = false,
  variant = "outline",
  size = "sm",
  disabled,
  ...props
}: CSVExporterProps) {
  const computedFilename =
    filename ??
    `wallet-addresses-${protocol}-${new Date().toISOString().slice(0, 10)}.csv`;

  const handleExport = () => {
    if (!addresses.length || typeof document === "undefined") {
      return;
    }

    // Simplified CSV format: address,derivation_index
    const headers = ["address", "derivation_index"];

    const rows = addresses.map((item) => {
      const values = [
        escapeCsvValue(item.address),
        escapeCsvValue(item.derivationIndex),
      ];

      return values.join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = computedFilename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={disabled || !addresses.length}
      onClick={handleExport}
      {...props}
    >
      Export CSV
    </Button>
  );
}
