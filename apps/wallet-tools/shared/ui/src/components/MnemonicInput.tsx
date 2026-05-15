import * as React from "react";

import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { cn } from "../lib/utils";
import { createOrImportMnemonic } from "@payin/wallet-core";

export interface MnemonicInputProps
  extends Omit<
    React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    'onChange' | 'value'
  > {
  value: string;
  onChange: (value: string) => void;
  onValidate?: (valid: boolean) => void;
  disabled?: boolean;
  helperText?: string;
  label?: string;
}

export function MnemonicInput({
  value,
  onChange,
  onValidate,
  helperText,
  label = "Import Mnemonic",
  disabled,
  className,
  ...props
}: MnemonicInputProps) {
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!value) {
      setError(null);
      onValidate?.(false);
      return;
    }

    try {
      createOrImportMnemonic(value);
      setError(null);
      onValidate?.(true);
    } catch (validationError) {
      setError("Invalid BIP39 mnemonic phrase. Please double-check the words.");
      onValidate?.(false);
    }
  }, [value, onValidate]);

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor="mnemonic-input">{label}</Label>
      <Textarea
        id="mnemonic-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="word1 word2 word3 ..."
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        disabled={disabled}
        className={cn(
          "font-mono text-sm",
          error && "border-destructive focus-visible:ring-destructive"
        )}
        {...props}
      />
      {helperText && !error ? (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {disabled ? (
        <p className="text-xs text-muted-foreground">
          Mnemonic import is disabled in this environment for security reasons.
        </p>
      ) : null}
    </div>
  );
}
