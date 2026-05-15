import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { CopyButton } from "./CopyButton";
import { cn } from "../lib/utils";

export interface MnemonicDisplayProps {
  mnemonic: string;
  onCopy?: () => void;
  hideByDefault?: boolean;
  className?: string;
}

export function MnemonicDisplay({
  mnemonic,
  onCopy,
  hideByDefault = true,
  className,
}: MnemonicDisplayProps) {
  const [revealed, setRevealed] = React.useState(!hideByDefault);

  React.useEffect(() => {
    setRevealed(!hideByDefault);
  }, [hideByDefault, mnemonic]);

  const words = React.useMemo(
    () => mnemonic.trim().split(/\s+/).filter(Boolean),
    [mnemonic]
  );

  const masked = React.useMemo(
    () =>
      words
        .map((_, index) => String(index + 1).padStart(2, "0") + ". ••••")
        .join("  "),
    [words]
  );

  return (
    <Card className={cn("bg-muted/40", className)}>
      <CardHeader className="flex items-center justify-between space-y-0">
        <CardTitle className="text-base">Mnemonic Phrase</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setRevealed((value) => !value)}
          >
            {revealed ? (
              <>
                <EyeOff className="mr-2 h-4 w-4" />
                Hide
              </>
            ) : (
              <>
                <Eye className="mr-2 h-4 w-4" />
                Reveal
              </>
            )}
          </Button>
          <CopyButton
            value={mnemonic}
            label="Copy"
            copiedLabel="Copied"
            onCopy={onCopy}
            disabled={!mnemonic}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "rounded-md border border-dashed bg-background/50 p-4 font-mono text-sm leading-relaxed transition-all",
            revealed ? "border-border text-foreground" : "border-border/50 text-muted-foreground blur-sm"
          )}
        >
          {revealed
            ? words.map((word, index) => (
                <span key={`${word}-${index}`} className="inline-block pr-3">
                  <span className="text-xs text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}.
                  </span>{" "}
                  {word}
                </span>
              ))
            : masked}
        </div>
        {!revealed && (
          <p className="mt-2 text-xs text-muted-foreground">
            Click Reveal to display the mnemonic temporarily. Keep your seed
            phrase secret.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
