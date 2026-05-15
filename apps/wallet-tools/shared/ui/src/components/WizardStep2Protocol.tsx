import { useState } from 'react';
import type { Protocol } from '@payin/wallet-core/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Check, ArrowRight, ArrowLeft } from 'lucide-react';

export interface WizardStep2Props {
  protocol: Protocol;
  onProtocolChange: (protocol: Protocol) => void;
  startIndex: number;
  onStartIndexChange: (index: number) => void;
  count: number;
  onCountChange: (count: number) => void;
  onNext: () => void;
  onPrevious: () => void;
  isLoading: boolean;
  maxCount: number;
  environment: 'extension' | 'web-private' | 'web-normal';
}

const PROTOCOLS: Array<{
  id: Protocol;
  name: string;
  description: string;
  color: string;
}> = [
  {
    id: 'evm',
    name: 'EVM',
    description: 'Ethereum, Polygon, BSC',
    color: 'bg-blue-500/10 border-blue-500 text-blue-700',
  },
  {
    id: 'tron',
    name: 'Tron',
    description: 'Tron Network',
    color: 'bg-red-500/10 border-red-500 text-red-700',
  },
  {
    id: 'solana',
    name: 'Solana',
    description: 'Solana Network',
    color: 'bg-purple-500/10 border-purple-500 text-purple-700',
  },
];

export function WizardStep2Protocol({
  protocol,
  onProtocolChange,
  startIndex,
  onStartIndexChange,
  count,
  onCountChange,
  onNext,
  onPrevious,
  isLoading,
  maxCount,
  environment,
}: WizardStep2Props) {
  const [hasGenerated, setHasGenerated] = useState(false);

  const handleGenerate = () => {
    setHasGenerated(true);
    onNext();
  };

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                2
              </span>
              Protocol & Settings
            </CardTitle>
            <CardDescription className="mt-1 text-xs">
              Select blockchain protocol and configure generation
            </CardDescription>
          </div>
          {hasGenerated && (
            <Check className="h-6 w-6 text-green-600" />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Protocol Selection */}
        <div className="space-y-2">
          <Label className="text-sm">Blockchain Protocol</Label>
          <div className="grid grid-cols-3 gap-2">
            {PROTOCOLS.map((p) => (
              <button
                key={p.id}
                onClick={() => onProtocolChange(p.id)}
                className={`p-2 border-2 rounded-lg text-left transition-all ${
                  protocol === p.id
                    ? `${p.color}`
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="font-semibold text-sm">{p.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {p.description}
                </div>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            💡 The same mnemonic works for all protocols
          </p>
        </div>

        {/* Generation Settings */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="start-index" className="text-sm">Start Index</Label>
            <Input
              id="start-index"
              type="number"
              min={0}
              value={startIndex}
              onChange={(e) => onStartIndexChange(Number(e.target.value))}
              placeholder="0"
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">
              HD wallet derivation start
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="count" className="text-sm">Address Count</Label>
            <Input
              id="count"
              type="number"
              min={1}
              max={maxCount}
              value={count}
              onChange={(e) => onCountChange(Number(e.target.value))}
              placeholder="10"
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Max {maxCount} in {environment === 'extension' ? 'extension' : 'web'}
            </p>
          </div>
        </div>

        {/* Environment Notice */}
        {environment !== 'extension' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2">
            <p className="text-xs text-yellow-800">
              ⚠️ Web mode limited to {maxCount} addresses. Install extension for unlimited generation.
            </p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-2">
          <Button
            onClick={onPrevious}
            variant="outline"
            size="sm"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={isLoading}
            size="sm"
          >
            {isLoading ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                Generating...
              </>
            ) : (
              <>
                Generate
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
