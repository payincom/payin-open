import { useState, useEffect } from 'react'
import type { Protocol, GeneratedAddress, Environment } from '@payin/wallet-core/types'
import {
  generateAddresses,
  createOrImportMnemonic,
  getEnvironmentLimits,
} from '@payin/wallet-core'

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Label,
  Textarea,
  WizardStep2Protocol,
  detectEnvironment,
  getSecurityWarning,
} from '@payin/wallet-ui'
import { Alert, AlertDescription } from '@payin/wallet-ui'
import { AlertCircle, Shield, ShieldAlert, ShieldCheck, Check, Copy, RefreshCw, ArrowRight, Download, ArrowLeft } from 'lucide-react'

/**
 * Detect browser and OS for showing appropriate keyboard shortcuts
 */
function detectBrowserAndOS() {
  const ua = navigator.userAgent.toLowerCase()
  const isMac = /mac|ipad|iphone|ipod/.test(ua)
  const isWindows = /win/.test(ua)
  const isLinux = /linux/.test(ua)

  let browser = 'unknown'
  let os = 'unknown'

  // Detect OS
  if (isMac) os = 'mac'
  else if (isWindows) os = 'windows'
  else if (isLinux) os = 'linux'

  // Detect browser
  if (ua.includes('edg')) browser = 'edge'
  else if (ua.includes('chrome') && !ua.includes('edg')) browser = 'chrome'
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'safari'
  else if (ua.includes('firefox')) browser = 'firefox'

  return { browser, os }
}

/**
 * Get private mode keyboard shortcut based on browser and OS
 */
function getPrivateModeShortcut(browser: string, os: string): string {
  const isMac = os === 'mac'
  const mod = isMac ? '⌘' : 'Ctrl'

  switch (browser) {
    case 'chrome':
    case 'edge':
      return `${mod}+Shift+N`
    case 'firefox':
      return `${mod}+Shift+P`
    case 'safari':
      return isMac ? '⌘+Shift+N' : 'Ctrl+Shift+N'
    default:
      return isMac ? '⌘+Shift+N / ⌘+Shift+P' : 'Ctrl+Shift+N / Ctrl+Shift+P'
  }
}

function App() {
  // Environment detection
  const [environment, setEnvironment] = useState<Environment>('web-normal')
  const [isDetecting, setIsDetecting] = useState(true)
  const [browserInfo, setBrowserInfo] = useState({ browser: 'unknown', os: 'unknown' })

  // Dev mode override (for testing without private mode)
  const [devModeBypass, setDevModeBypass] = useState(false)

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1)
  const [mnemonic, setMnemonic] = useState<string>('')
  const [isBackedUp, setIsBackedUp] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [isUrlCopied, setIsUrlCopied] = useState(false)
  const [protocol, setProtocol] = useState<Protocol>('evm')
  const [startIndex, setStartIndex] = useState(0)
  const [count, setCount] = useState(10)
  const [addresses, setAddresses] = useState<GeneratedAddress[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Generate real mnemonic when component mounts or when requested
  const generateNewMnemonic = () => {
    const mnemonicObj = createOrImportMnemonic()
    setMnemonic(mnemonicObj.phrase)
    setIsBackedUp(false) // Reset backup confirmation when generating new mnemonic
    setIsCopied(false) // Reset copy state when generating new mnemonic
  }

  // Handle copy mnemonic
  const handleCopyMnemonic = () => {
    navigator.clipboard.writeText(mnemonic)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000) // Reset after 2 seconds
  }

  const handleCopyUrl = () => {
    const currentUrl = window.location.href
    navigator.clipboard.writeText(currentUrl)
    setIsUrlCopied(true)
    setTimeout(() => setIsUrlCopied(false), 2000) // Reset after 2 seconds
  }

  const limits = getEnvironmentLimits(environment === 'extension' ? 'extension' : 'web')
  const securityWarning = (() => {
    const warning = getSecurityWarning(environment)
    // Override message for web-private
    if (environment === 'web-private') {
      return {
        ...warning,
        message: 'For enhanced security, disconnect from the internet before use. Your data will be cleared when you close this tab.',
      }
    }
    return warning
  })()

  // Detect environment on mount
  useEffect(() => {
    // Detect browser and OS
    const info = detectBrowserAndOS()
    setBrowserInfo(info)

    // Detect environment (private mode)
    detectEnvironment().then((env) => {
      setEnvironment(env)
      setIsDetecting(false)
    })
  }, [])

  const goToStep = (step: number) => {
    setCurrentStep(step)
  }

  const handleGenerateAddresses = async () => {
    setIsLoading(true)
    try {
      // Create or import mnemonic
      const mnemonicObj = mnemonic
        ? createOrImportMnemonic(mnemonic)
        : createOrImportMnemonic()

      setMnemonic(mnemonicObj.phrase)

      // Generate addresses
      const generated = generateAddresses(
        protocol,
        mnemonicObj,
        startIndex,
        count
      )
      setAddresses(generated)
      setCurrentStep(3)
    } catch (error) {
      console.error('Generation error:', error)
      alert('Failed to generate addresses. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyAddresses = () => {
    // Copy in CSV format: address,derivation_index
    const addressList = addresses.map((addr) => `${addr.address},${addr.derivationIndex}`).join('\n')
    navigator.clipboard.writeText(addressList)
    alert('Addresses copied to clipboard!')
  }

  const handleDownloadCSV = () => {
    // Use standard format: address,derivation_index
    const csvHeader = 'address,derivation_index\n'
    const csvContent = addresses
      .map((addr) => `${addr.address},${addr.derivationIndex}`)
      .join('\n')
    const fullCSV = csvHeader + csvContent

    const blob = new Blob([fullCSV], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `addresses_${protocol}_${Date.now()}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleGenerateMore = () => {
    goToStep(2)
  }

  // Security icon based on environment
  const getSecurityIcon = () => {
    switch (securityWarning.type) {
      case 'success':
        return <ShieldCheck className="h-5 w-5" />
      case 'warning':
        return <Shield className="h-5 w-5" />
      case 'error':
        return <ShieldAlert className="h-5 w-5" />
    }
  }

  // Security alert variant
  const getAlertVariant = () => {
    if (securityWarning.type === 'error') return 'destructive'
    return 'default'
  }

  if (isDetecting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Detecting environment...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">PayIn Wallet Tools</h1>
          <p className="text-sm text-muted-foreground">
            HD Wallet Address Generator
          </p>
        </div>

        {/* Wizard Steps */}
        {securityWarning.canProceed ? (
          <>
            {/* Step 1: Mnemonic */}
            {currentStep === 1 && (
              <Card className="border-2 min-h-[600px] flex flex-col">
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
                    {mnemonic && <Check className="h-6 w-6 text-green-600" />}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <div className="flex-1 space-y-4">
                  {/* Security Warning - Only in Step 1 */}
                  <Alert variant={getAlertVariant()}>
                    <div className="flex items-start gap-3">
                      {getSecurityIcon()}
                      <div className="flex-1">
                        <AlertDescription>
                          <div className="font-semibold mb-1">{securityWarning.title}</div>
                          <div className="text-sm">{securityWarning.message}</div>
                        </AlertDescription>
                      </div>
                    </div>
                  </Alert>
                  {/* Mode Selection - Only show for extension */}
                  {securityWarning.canImportMnemonic && (
                    <div className="space-y-2">
                      <Label className="text-sm">Mnemonic Source</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setMnemonic('')}
                          className="p-3 border-2 rounded-lg text-left transition-all border-primary bg-primary/5"
                        >
                          <div className="font-semibold text-sm">Generate New</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Create fresh mnemonic
                          </div>
                        </button>
                        <button
                          className="p-3 border-2 rounded-lg text-left transition-all border-border hover:border-primary/50"
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
                  <div className="space-y-3">
                    {!mnemonic ? (
                      <Button onClick={generateNewMnemonic} size="sm" className="w-full border-2">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Generate Mnemonic
                      </Button>
                    ) : (
                      <>
                        {/* Mnemonic Display - Always visible */}
                        <div className="space-y-2">
                          <div className="bg-muted p-3 rounded-lg font-mono text-xs leading-relaxed">
                            {mnemonic.split(' ').filter(w => w.trim()).map((word, i) =>
                              `${String(i + 1).padStart(2, '0')}. ${word}`
                            ).join('  ')}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCopyMnemonic}
                            className="w-full text-xs"
                          >
                            {isCopied ? (
                              <>
                                <Check className="mr-2 h-3 w-3" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="mr-2 h-3 w-3" />
                                Copy Mnemonic
                              </>
                            )}
                          </Button>
                        </div>

                        {/* Regenerate Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={generateNewMnemonic}
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
                  </div>

                  {/* Navigation - Fixed at bottom */}
                  <div className="flex justify-end pt-4 mt-auto">
                    <Button
                      onClick={() => {
                        if (!isBackedUp && mnemonic) {
                          alert('Please confirm that you have backed up your mnemonic phrase!');
                          return;
                        }
                        goToStep(2);
                      }}
                      disabled={!mnemonic}
                      size="sm"
                      className="border-2"
                    >
                      Next
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Protocol & Settings */}
            {currentStep === 2 && (
              <div style={{ minHeight: '600px', display: 'flex', flexDirection: 'column' }}>
                <style>{`
                  [data-step="2"] > * {
                    min-height: 600px !important;
                    display: flex !important;
                    flex-direction: column !important;
                  }
                  [data-step="2"] .space-y-4 {
                    display: flex !important;
                    flex-direction: column !important;
                    flex: 1 !important;
                    gap: 1rem !important;
                  }
                  [data-step="2"] .space-y-4 > div:last-child {
                    margin-top: auto !important;
                  }
                  [data-step="2"] .space-y-4 > div:last-child button:last-child {
                    border-width: 2px !important;
                  }
                `}</style>
                <div data-step="2" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <WizardStep2Protocol
                    protocol={protocol}
                    onProtocolChange={setProtocol}
                    startIndex={startIndex}
                    onStartIndexChange={setStartIndex}
                    count={count}
                    onCountChange={setCount}
                    onNext={handleGenerateAddresses}
                    onPrevious={() => goToStep(1)}
                    isLoading={isLoading}
                    maxCount={limits.maxAddresses}
                    environment={environment}
                  />
                </div>
              </div>
            )}

            {/* Step 3: Generated Addresses */}
            {currentStep === 3 && addresses.length > 0 && (
              <Card className="border-2 min-h-[600px] flex flex-col">
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
                        <Badge variant="outline" className="ml-1 text-xs">
                          {protocol.toUpperCase()}
                        </Badge>
                      </CardDescription>
                    </div>
                    <Check className="h-6 w-6 text-green-600" />
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <div className="flex-1 space-y-4">
                  {/* Address List */}
                  <div className="space-y-2">
                    <Label htmlFor="address-list" className="text-sm">Address List (address,derivation_index)</Label>
                    <Textarea
                      id="address-list"
                      value={addresses.map(addr => `${addr.address},${addr.derivationIndex}`).join('\n')}
                      readOnly
                      rows={Math.min(addresses.length, 10)}
                      className="font-mono text-xs resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      {addresses.length} addresses • Index {addresses[0]?.derivationIndex ?? 0} to{' '}
                      {addresses[addresses.length - 1]?.derivationIndex ?? 0}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={handleCopyAddresses} size="sm" className="text-xs">
                      <Copy className="mr-1 h-3 w-3" />
                      Copy
                    </Button>
                    <Button variant="outline" onClick={handleDownloadCSV} size="sm" className="text-xs">
                      <Download className="mr-1 h-3 w-3" />
                      CSV
                    </Button>
                  </div>

                  {/* Info Cards */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                      <div className="text-xs font-semibold text-blue-900">Protocol</div>
                      <div className="text-sm font-bold text-blue-700 mt-0.5">
                        {protocol.toUpperCase()}
                      </div>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                      <div className="text-xs font-semibold text-green-900">Total</div>
                      <div className="text-sm font-bold text-green-700 mt-0.5">
                        {addresses.length} addresses
                      </div>
                    </div>
                  </div>
                  </div>

                  {/* Navigation - Fixed at bottom */}
                  <div className="flex justify-start pt-4 mt-auto">
                    <Button
                      onClick={() => goToStep(2)}
                      variant="outline"
                      size="sm"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Previous
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <AlertCircle className="h-16 w-16 text-destructive mx-auto" />
                <div>
                  <h3 className="text-lg font-semibold">Private Browsing Required</h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                    This tool handles sensitive wallet information. Private browsing mode ensures your mnemonic phrase and private keys are never stored in browser history or cache.
                  </p>
                  <div className="mt-6 space-y-4">
                    {/* Why Private Mode */}
                    <div className="bg-muted/50 rounded-lg p-4 text-left">
                      <div className="text-sm space-y-2">
                        <div className="flex items-start gap-2">
                          <div className="text-green-600 mt-0.5">✓</div>
                          <span className="text-muted-foreground">No browsing history</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="text-green-600 mt-0.5">✓</div>
                          <span className="text-muted-foreground">No cache or cookies</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="text-green-600 mt-0.5">✓</div>
                          <span className="text-muted-foreground">Enhanced privacy protection</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Access */}
                    <div className="bg-muted rounded-lg p-4 text-left space-y-3">
                      <div className="text-sm font-semibold">URL:</div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 px-3 py-2 bg-background border border-border rounded font-mono text-xs break-all">
                          {window.location.href}
                        </code>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCopyUrl}
                          className="shrink-0"
                        >
                          {isUrlCopied ? (
                            <>
                              <Check className="h-3 w-3" />
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                            </>
                          )}
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-2">
                        <div className="flex items-center gap-2">
                          <span>Open private mode:</span>
                          <kbd className="px-2 py-1 bg-background border border-border rounded font-mono text-xs font-semibold">
                            {getPrivateModeShortcut(browserInfo.browser, browserInfo.os)}
                          </kbd>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default App
