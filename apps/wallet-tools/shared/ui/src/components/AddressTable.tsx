import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Badge } from "./ui/badge";
import { CopyButton } from "./CopyButton";
import { cn } from "../lib/utils";
import type { GeneratedAddress, Protocol } from "@payin/wallet-core";

export interface AddressTableProps {
  addresses: GeneratedAddress[];
  protocol: Protocol;
  onCopy?: (value: string, type: "address" | "privateKey" | "path") => void;
  showPrivateKeys?: boolean;
  className?: string;
  caption?: string;
}

export function AddressTable({
  addresses,
  protocol,
  onCopy,
  showPrivateKeys = false,
  caption,
  className,
}: AddressTableProps) {
  if (!addresses.length) {
    return null;
  }

  const resolvedCaption =
    caption ?? `Generated ${protocol.toUpperCase()} addresses`;

  return (
    <div className={cn("rounded-lg border", className)}>
      <Table>
        {resolvedCaption ? <TableCaption>{resolvedCaption}</TableCaption> : null}
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Index</TableHead>
            <TableHead>Address</TableHead>
            <TableHead className="hidden lg:table-cell">Path</TableHead>
            {showPrivateKeys ? (
              <TableHead className="hidden xl:table-cell">
                Private Key
              </TableHead>
            ) : null}
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {addresses.map((item) => (
            <TableRow key={`${item.address}-${item.derivationIndex}`}>
              <TableCell>
                <Badge variant="secondary" className="font-mono">
                  #{item.derivationIndex}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-xs md:text-sm">
                {item.address}
              </TableCell>
              <TableCell className="hidden font-mono text-xs text-muted-foreground lg:table-cell">
                {item.path}
              </TableCell>
              {showPrivateKeys ? (
                <TableCell className="hidden font-mono text-xs text-muted-foreground xl:table-cell">
                  {item.privateKey}
                </TableCell>
              ) : null}
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <CopyButton
                    value={item.address}
                    size="sm"
                    label="Copy Address"
                    onCopy={() => onCopy?.(item.address, "address")}
                  />
                  <CopyButton
                    value={item.path}
                    size="sm"
                    variant="ghost"
                    label="Copy Path"
                    onCopy={() => onCopy?.(item.path, "path")}
                  />
                  {showPrivateKeys ? (
                    <CopyButton
                      value={item.privateKey}
                      size="sm"
                      variant="destructive"
                      label="Copy Private Key"
                      copiedLabel="Copied!"
                      onCopy={() => onCopy?.(item.privateKey, "privateKey")}
                    />
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
