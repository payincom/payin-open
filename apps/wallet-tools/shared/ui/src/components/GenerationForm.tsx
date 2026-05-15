import * as React from "react";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { MnemonicDisplay } from "./MnemonicDisplay";
import { MnemonicInput } from "./MnemonicInput";
import type {
  EnvironmentLimits,
  GenerateOptions,
  Protocol,
} from "@payin/wallet-core";
import { createOrImportMnemonic } from "@payin/wallet-core";
import { cn } from "../lib/utils";

function clampCountValue(value: number, max?: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }

  const sanitized = Math.floor(value);

  if (typeof max === "number") {
    return Math.min(sanitized, max);
  }

  return sanitized;
}

function getDefaultPath(protocol: Protocol): string {
  switch (protocol) {
    case "tron":
      return "m/44'/195'/0'/0/{index}";
    case "solana":
      return "m/44'/501'/{index}'/0'";
    case "evm":
    default:
      return "m/44'/60'/0'/0/{index}";
  }
}

export interface GenerationFormProps {
  protocol: Protocol;
  limits: EnvironmentLimits;
  onGenerate: (options: GenerateOptions) => void;
  initialMnemonic?: string;
  initialStartIndex?: number;
  initialCount?: number;
  initialCustomPath?: string;
  isLoading?: boolean;
  className?: string;
  onMnemonicChange?: (mnemonic: string) => void;
}

export function GenerationForm({
  protocol,
  limits,
  onGenerate,
  initialMnemonic,
  initialStartIndex = 0,
  initialCount,
  initialCustomPath,
  isLoading,
  className,
  onMnemonicChange,
}: GenerationFormProps) {
  const maxCount = Number.isFinite(limits.maxAddressCount)
    ? Math.max(1, Math.floor(limits.maxAddressCount))
    : undefined;

  const defaultMnemonic = React.useMemo(
    () => initialMnemonic ?? createOrImportMnemonic().phrase,
    [initialMnemonic]
  );

  const [mnemonic, setMnemonic] = React.useState(defaultMnemonic);
  const [isMnemonicValid, setIsMnemonicValid] = React.useState(true);
  const [startIndex, setStartIndex] = React.useState(initialStartIndex);
  const [count, setCount] = React.useState(() =>
    clampCountValue(
      initialCount ?? Math.min(5, maxCount ?? 5),
      maxCount
    )
  );

  const defaultPathRef = React.useRef(getDefaultPath(protocol));

  const [customPath, setCustomPath] = React.useState(
    initialCustomPath ?? defaultPathRef.current
  );

  React.useEffect(() => {
    setMnemonic(defaultMnemonic);
    setIsMnemonicValid(true);
  }, [defaultMnemonic]);

  React.useEffect(() => {
    if (typeof maxCount === "number") {
      setCount((current) => clampCountValue(current, maxCount));
    }
  }, [maxCount]);

  React.useEffect(() => {
    const nextDefault = getDefaultPath(protocol);
    if (!initialCustomPath && customPath === defaultPathRef.current) {
      setCustomPath(nextDefault);
    }
    defaultPathRef.current = nextDefault;
  }, [protocol, initialCustomPath, customPath]);

  React.useEffect(() => {
    onMnemonicChange?.(mnemonic);
  }, [mnemonic, onMnemonicChange]);

  const handleMnemonicImport = (value: string) => {
    setMnemonic(value);
  };

  const handleGenerate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!mnemonic || !isMnemonicValid) {
      return;
    }

    const sanitizedCount = clampCountValue(count, maxCount);
    const sanitizedStart = Number.isFinite(startIndex)
      ? Math.max(0, Math.floor(startIndex))
      : 0;

    const options: GenerateOptions = {
      protocol,
      mnemonic: mnemonic.trim(),
      startIndex: sanitizedStart,
      count: sanitizedCount,
    };

    if (limits.allowCustomPath && customPath) {
      options.customPath = customPath;
    }

    onGenerate(options);
  };

  const regenerateMnemonic = () => {
    const generated = createOrImportMnemonic();
    setMnemonic(generated.phrase);
    setIsMnemonicValid(true);
  };

  return (
    <Card className={cn("space-y-4", className)}>
      <CardHeader>
        <CardTitle className="text-base">Address Generation</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={handleGenerate}>
          <div className="space-y-4">
            <MnemonicDisplay mnemonic={mnemonic} hideByDefault />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Keep this mnemonic confidential. It will never leave your
                browser/session.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={regenerateMnemonic}
                disabled={isLoading}
              >
                Generate New Mnemonic
              </Button>
            </div>
          </div>

          {limits.allowMnemonicImport ? (
            <MnemonicInput
              value={mnemonic}
              onChange={handleMnemonicImport}
              onValidate={setIsMnemonicValid}
              helperText="Paste an existing 12 or 24-word mnemonic to re-use a wallet."
              disabled={isLoading}
            />
          ) : (
            <div className="rounded-md border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
              Mnemonic import is disabled in this environment. A temporary seed
              phrase will be generated for each session.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start-index">Start Index</Label>
              <Input
                id="start-index"
                type="number"
                inputMode="numeric"
                min={0}
                value={startIndex}
                onChange={(event) => {
                  const value = Number.parseInt(event.target.value, 10);
                  setStartIndex(Number.isNaN(value) ? 0 : Math.max(0, value));
                }}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address-count">Address Count</Label>
              <Input
                id="address-count"
                type="number"
                inputMode="numeric"
                min={1}
                {...(typeof maxCount === "number" ? { max: maxCount } : {})}
                value={count}
                onChange={(event) => {
                  const value = Number.parseInt(event.target.value, 10);
                  setCount(
                    clampCountValue(Number.isNaN(value) ? 1 : value, maxCount)
                  );
                }}
                disabled={isLoading}
              />
              {typeof maxCount === "number" ? (
                <p className="text-xs text-muted-foreground">
                  Limited to {maxCount} addresses in this environment.
                </p>
              ) : null}
            </div>
          </div>

          {limits.allowCustomPath ? (
            <div className="space-y-2">
              <Label htmlFor="custom-path">Custom Derivation Path</Label>
              <Input
                id="custom-path"
                type="text"
                value={customPath}
                onChange={(event) => setCustomPath(event.target.value)}
                placeholder={getDefaultPath(protocol)}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Use &#123;index&#125; as a placeholder for the derivation index.
              </p>
            </div>
          ) : (
            <div className="rounded-md border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
              Custom derivation paths are locked in this environment. Standard
              BIP44 paths will be used automatically.
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Generated addresses are deterministic. Re-using the same mnemonic,
              protocol, and indices will reproduce identical addresses.
            </p>
            <Button
              type="submit"
              disabled={isLoading || !mnemonic || !isMnemonicValid}
            >
              {isLoading ? "Generating..." : "Generate Addresses"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
