import type { Protocol, GeneratedAddress } from '@payin/wallet-core/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Check, Download, Copy, RefreshCw, ArrowLeft } from 'lucide-react';
import { Badge } from './ui/badge';

export interface WizardStep3Props {
  addresses: GeneratedAddress[];
  protocol: Protocol;
  onCopy: () => void;
  onDownloadCSV: () => void;
  onGenerateMore: () => void;
  onPrevious: () => void;
  showPrivateKeys: boolean;
}

export function WizardStep3Addresses({
  addresses,
  protocol,
  onCopy,
  onDownloadCSV,
  onGenerateMore,
  onPrevious,
  showPrivateKeys,
}: WizardStep3Props) {
  // Format addresses as textarea content (one per line)
  const addressList = addresses.map((addr) => addr.address).join('\n');

  const protocolColors: Record<Protocol, string> = {
    evm: 'bg-blue-500',
    tron: 'bg-red-500',
    solana: 'bg-purple-500',
  };

  const protocolNames: Record<Protocol, string> = {
    evm: 'EVM',
    tron: 'Tron',
    solana: 'Solana',
  };

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                3
              </span>
              Generated Addresses
            </CardTitle>
            <CardDescription className="mt-1 text-xs">
              {addresses.length} addresses for{' '}
              <Badge variant="outline" className={`ml-1 ${protocolColors[protocol]} text-white text-xs`}>
                {protocolNames[protocol]}
              </Badge>
            </CardDescription>
          </div>
          <Check className="h-6 w-6 text-green-600" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Address List */}
        <div className="space-y-2">
          <Label htmlFor="address-list" className="text-sm">Address List (one per line)</Label>
          <Textarea
            id="address-list"
            value={addressList}
            readOnly
            rows={Math.min(addresses.length, 10)}
            className="font-mono text-xs resize-none"
          />
          <p className="text-xs text-muted-foreground">
            {addresses.length} addresses • Index {addresses[0]?.derivationIndex || 0} to{' '}
            {addresses[addresses.length - 1]?.derivationIndex || 0}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" onClick={onCopy} size="sm" className="text-xs">
            <Copy className="mr-1 h-3 w-3" />
            Copy
          </Button>
          <Button variant="outline" onClick={onDownloadCSV} size="sm" className="text-xs">
            <Download className="mr-1 h-3 w-3" />
            CSV
          </Button>
          <Button variant="outline" onClick={onGenerateMore} size="sm" className="text-xs">
            <RefreshCw className="mr-1 h-3 w-3" />
            More
          </Button>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
            <div className="text-xs font-semibold text-blue-900">Protocol</div>
            <div className="text-sm font-bold text-blue-700 mt-0.5">
              {protocolNames[protocol]}
            </div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-2">
            <div className="text-xs font-semibold text-green-900">Total</div>
            <div className="text-sm font-bold text-green-700 mt-0.5">
              {addresses.length} addresses
            </div>
          </div>
        </div>

        {/* CSV Preview */}
        {showPrivateKeys && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
            <p className="text-xs text-amber-800 font-semibold">
              ⚠️ Private Keys Included
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              CSV includes private keys. Keep them safe!
            </p>
          </div>
        )}

        {/* Security Notice */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
          <p className="text-xs font-semibold text-slate-900">💡 Usage Tips</p>
          <ul className="text-xs text-slate-700 mt-1 space-y-0.5 list-disc list-inside">
            <li>Copy addresses for immediate use</li>
            <li>Download CSV for batch import</li>
            <li>Generate more with same mnemonic</li>
            <li>Switch protocols in Step 2</li>
          </ul>
        </div>

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
            onClick={onGenerateMore}
            variant="default"
            size="sm"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Generate More
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
