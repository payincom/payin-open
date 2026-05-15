import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Alert, AlertDescription } from './ui/alert';
import { AlertCircle, Check, Eye, EyeOff, Copy, RefreshCw, ArrowRight } from 'lucide-react';

export interface WizardStep1Props {
  mnemonic: string;
  onMnemonicChange: (mnemonic: string) => void;
  onGenerateMnemonic: () => void;
  onNext: () => void;
  canImportMnemonic: boolean;
  environment: 'extension' | 'web-private' | 'web-normal';
}

export function WizardStep1Mnemonic({
  mnemonic,
  onMnemonicChange,
  onGenerateMnemonic,
  onNext,
  canImportMnemonic,
}: WizardStep1Props) {
  const [mode, setMode] = useState<'generate' | 'import'>('generate');
  const [isRevealed, setIsRevealed] = useState(false);
  const [isBackedUp, setIsBackedUp] = useState(false);

  // If mnemonic already exists (returning from next step), auto-mark as backed up
  const hasExistingMnemonic = mnemonic && mnemonic.trim().length > 0;

  // Auto-reveal mnemonic when returning from next step
  useEffect(() => {
    if (hasExistingMnemonic && !isRevealed) {
      setIsRevealed(true);
    }
  }, [hasExistingMnemonic, isRevealed]);

  const handleGenerate = () => {
    onGenerateMnemonic();
    setIsRevealed(true);
    setIsBackedUp(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(mnemonic);
  };

  const handleNext = () => {
    if (mode === 'generate' && !isBackedUp) {
      alert('Please confirm that you have backed up your mnemonic phrase!');
      return;
    }
    if (!mnemonic.trim()) {
      alert('Please generate or import a mnemonic phrase first!');
      return;
    }
    onNext();
  };

  const mnemonicWords = mnemonic.split(' ').filter((w) => w.trim());
  const displayMnemonic = isRevealed
    ? mnemonicWords.map((word, i) => `${String(i + 1).padStart(2, '0')}. ${word}`).join('  ')
    : mnemonicWords.map((_, i) => `${String(i + 1).padStart(2, '0')}. ••••`).join('  ');

  // Allow proceeding if: importing, backed up, or returning with existing mnemonic
  const canProceed = mnemonic && (mode === 'import' || isBackedUp || hasExistingMnemonic);

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                1
              </span>
              Mnemonic Phrase
            </CardTitle>
            <CardDescription className="mt-1 text-xs">
              Generate a new mnemonic or import an existing one
            </CardDescription>
          </div>
          {canProceed && (
            <Check className="h-6 w-6 text-green-600" />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode Selection - Only show for extension */}
        {canImportMnemonic && (
          <div className="space-y-2">
            <Label className="text-sm">Mnemonic Source</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode('generate')}
                className={`p-3 border-2 rounded-lg text-left transition-all ${
                  mode === 'generate'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="font-semibold text-sm">Generate New</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Create fresh mnemonic
                </div>
              </button>
              <button
                onClick={() => setMode('import')}
                className={`p-3 border-2 rounded-lg text-left transition-all ${
                  mode === 'import'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="font-semibold text-sm">Import Existing</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Use your own
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Generate Mode */}
        {mode === 'generate' && (
          <div className="space-y-3">
            {!mnemonic ? (
              <Button onClick={handleGenerate} size="sm" className="w-full">
                <RefreshCw className="mr-2 h-4 w-4" />
                Generate Mnemonic
              </Button>
            ) : (
              <>
                {/* Mnemonic Display */}
                <div className="space-y-2">
                  <div className="bg-muted p-3 rounded-lg font-mono text-xs leading-relaxed">
                    {displayMnemonic}
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsRevealed(!isRevealed)}
                      className="text-xs flex-1"
                    >
                      {isRevealed ? <EyeOff className="mr-1 h-3 w-3" /> : <Eye className="mr-1 h-3 w-3" />}
                      {isRevealed ? 'Hide' : 'Show'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleCopy} className="text-xs flex-1">
                      <Copy className="mr-1 h-3 w-3" />
                      Copy
                    </Button>
                  </div>
                </div>

                {/* Regenerate Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerate}
                  className="w-full text-xs"
                >
                  <RefreshCw className="mr-2 h-3 w-3" />
                  Regenerate New Mnemonic
                </Button>

                {/* Critical Warning */}
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs font-semibold">
                    Back up this mnemonic immediately!
                    <p className="font-normal mt-1">
                      This is the ONLY way to recover your wallet.
                    </p>
                  </AlertDescription>
                </Alert>

                {/* Backup Confirmation */}
                <div className="flex items-start space-x-2">
                  <input
                    type="checkbox"
                    id="backed-up"
                    checked={isBackedUp}
                    onChange={(e) => setIsBackedUp(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300"
                  />
                  <label htmlFor="backed-up" className="text-xs cursor-pointer">
                    I have safely backed up my mnemonic phrase
                  </label>
                </div>
              </>
            )}
          </div>
        )}

        {/* Import Mode */}
        {mode === 'import' && canImportMnemonic && (
          <div className="space-y-2">
            <Label htmlFor="mnemonic-input" className="text-sm">Enter Your Mnemonic Phrase</Label>
            <Textarea
              id="mnemonic-input"
              placeholder="word1 word2 word3 ... word12"
              value={mnemonic}
              onChange={(e) => onMnemonicChange(e.target.value)}
              rows={3}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Enter 12 or 24 words separated by spaces
            </p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleNext}
            disabled={!canProceed}
            size="sm"
          >
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
