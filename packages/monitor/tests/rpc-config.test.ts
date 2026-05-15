/**
 * Monitor RPC Configuration Tests
 * 
 * Tests all RPC provider configuration modes:
 * 1. Built-in providers (alchemy, infura, ankr, etc.)
 * 2. Custom providers via code
 * 3. Custom providers via YAML
 * 4. Provider priority/override system
 * 5. Configuration merging
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { RPCConfigLoader } from '../src/rpc/config/config-loader.js'
import { BUILTIN_PROVIDERS } from '../src/rpc/config/provider-templates.js'
import type { ConfigFormat, RPCProviderKeys } from '../src/rpc/types/rpc-config.js'

describe('Monitor RPC Configuration Tests', () => {
  describe('1. Built-in Providers', () => {
    it('should load all built-in providers', () => {
      const builtinNames = Object.keys(BUILTIN_PROVIDERS)
      
      expect(builtinNames).toContain('alchemy')
      expect(builtinNames).toContain('infura')
      expect(builtinNames).toContain('ankr')
      expect(builtinNames).toContain('trongrid')
      expect(builtinNames).toContain('publicnode')
      expect(builtinNames).toContain('cloudflare')
      
      console.log(`✅ Found ${builtinNames.length} built-in providers: ${builtinNames.join(', ')}`)
    })

    it('should have correct structure for built-in providers', () => {
      const alchemy = BUILTIN_PROVIDERS.alchemy
      
      expect(alchemy).toBeDefined()
      expect(alchemy.displayName).toBe('Alchemy')
      expect(alchemy.authType).toBe('url_path')
      expect(alchemy.urlPattern).toContain('{network}')
      expect(alchemy.urlPattern).toContain('{apiKey}')
      expect(alchemy.supportedNetworks).toBeInstanceOf(Array)
      expect(alchemy.supportedNetworks.length).toBeGreaterThan(0)
      expect(alchemy.defaultSettings).toBeDefined()
      expect(alchemy.defaultSettings.timeout).toBeGreaterThan(0)
      expect(alchemy.defaultSettings.weight).toBeGreaterThan(0)
      expect(alchemy.defaultSettings.maxRequestsPerSecond).toBeGreaterThan(0)
      
      console.log('✅ Alchemy provider structure is correct')
    })

    it('should load built-in providers with API keys', async () => {
      const rpcKeys: RPCProviderKeys = {
        alchemy: 'test-alchemy-key',
        infura: 'test-infura-key'
      }

      const config: ConfigFormat = {
        chains: {
          'ethereum-sepolia': {
            strategy: 'round_robin',
            availableProviders: ['alchemy', 'infura'],
            defaultSettings: {
              weight: 50,
              timeout: 30000,
              maxRequestsPerSecond: 10
            }
          }
        }
      }

      const loader = new RPCConfigLoader(undefined, rpcKeys, config)
      const templates = await loader.loadProviderTemplates()
      
      expect(templates.length).toBeGreaterThanOrEqual(6) // At least 6 built-in providers
      
      const alchemyTemplate = templates.find(t => t.name === 'alchemy')
      expect(alchemyTemplate).toBeDefined()
      expect(alchemyTemplate?.displayName).toBe('Alchemy')
      
      console.log(`✅ Loaded ${templates.length} provider templates including built-in providers`)
    })

    it('should build correct RPC config with built-in providers', async () => {
      const rpcKeys: RPCProviderKeys = {
        alchemy: 'test-alchemy-key',
        infura: 'test-infura-key',
        ankr: 'test-ankr-key'
      }

      const config: ConfigFormat = {
        chains: {
          'ethereum-sepolia': {  // Use standard chain name (providers will map to their network names)
            strategy: 'round_robin',
            availableProviders: ['alchemy', 'infura', 'ankr'],
            defaultSettings: {
              weight: 50,
              timeout: 30000,
              maxRequestsPerSecond: 10
            }
          }
        }
      }

      const loader = new RPCConfigLoader(undefined, rpcKeys, config)
      const globalConfig = await loader.loadGlobalConfig()

      expect(globalConfig.chains['ethereum-sepolia']).toBeDefined()
      expect(globalConfig.chains['ethereum-sepolia'].endpoints.length).toBe(3)

      const endpoints = globalConfig.chains['ethereum-sepolia'].endpoints
      expect(endpoints.some(e => e.provider === 'alchemy')).toBe(true)
      expect(endpoints.some(e => e.provider === 'infura')).toBe(true)
      expect(endpoints.some(e => e.provider === 'ankr')).toBe(true)

      console.log('✅ Built RPC config with 3 built-in providers for ethereum-sepolia')
    })
  })

  describe('2. Custom Providers via Code', () => {
    it('should support custom providers via code configuration', async () => {
      const rpcKeys: RPCProviderKeys = {
        'my-custom-node': 'custom-api-key'
      }

      const config: ConfigFormat = {
        // Code-provided custom providers (highest priority)
        providers: {
          'my-custom-node': {
            displayName: 'My Custom Node',
            authType: 'header',
            urlPattern: 'https://custom.example.com/rpc',
            headerTemplate: { 'X-API-Key': '{apiKey}' },
            requiresApiKey: true,
            supportedChains: ['ethereum-sepolia'],
            defaultTimeout: 10000,
            defaultWeight: 100,
            defaultMaxRequestsPerSecond: 50
          }
        },
        chains: {
          'ethereum-sepolia': {
            strategy: 'failover',
            availableProviders: ['my-custom-node'],
            defaultSettings: {
              weight: 100,
              timeout: 10000,
              maxRequestsPerSecond: 50
            }
          }
        }
      }

      const loader = new RPCConfigLoader(undefined, rpcKeys, config)
      const templates = await loader.loadProviderTemplates()
      
      const customTemplate = templates.find(t => t.name === 'my-custom-node')
      expect(customTemplate).toBeDefined()
      expect(customTemplate?.displayName).toBe('My Custom Node')
      expect(customTemplate?.authType).toBe('header')
      
      console.log('✅ Custom provider loaded via code configuration')
    })

    it('should allow code providers to override built-in providers', async () => {
      const rpcKeys: RPCProviderKeys = {
        alchemy: 'my-custom-alchemy-key'
      }

      const config: ConfigFormat = {
        // Override built-in alchemy provider
        providers: {
          'alchemy': {
            displayName: 'Alchemy Custom',
            authType: 'url_path',
            urlPattern: 'https://custom-alchemy.example.com/{network}/{apiKey}',
            requiresApiKey: true,
            supportedChains: ['ethereum-sepolia'],
            defaultTimeout: 15000, // Different from built-in
            defaultWeight: 200, // Different from built-in
            defaultMaxRequestsPerSecond: 20
          }
        },
        chains: {
          'ethereum-sepolia': {
            strategy: 'round_robin',
            availableProviders: ['alchemy'],
            defaultSettings: {
              weight: 50,
              timeout: 30000,
              maxRequestsPerSecond: 10
            }
          }
        }
      }

      const loader = new RPCConfigLoader(undefined, rpcKeys, config)
      const templates = await loader.loadProviderTemplates()
      
      const alchemyTemplate = templates.find(t => t.name === 'alchemy')
      expect(alchemyTemplate).toBeDefined()
      expect(alchemyTemplate?.displayName).toBe('Alchemy Custom')
      expect(alchemyTemplate?.defaultTimeout).toBe(15000)
      expect(alchemyTemplate?.defaultWeight).toBe(200)
      
      console.log('✅ Code provider successfully overrode built-in alchemy provider')
    })
  })

  describe('3. Custom Providers via YAML customProviders', () => {
    it('should support customProviders from YAML-like config', async () => {
      const rpcKeys: RPCProviderKeys = {
        'enterprise-node': 'enterprise-key'
      }

      const config: ConfigFormat = {
        // YAML customProviders (middle priority)
        customProviders: {
          'enterprise-node': {
            displayName: 'Enterprise Node',
            authType: 'header',
            urlPattern: 'https://enterprise.example.com/{network}',
            headerTemplate: { 'Authorization': 'Bearer {apiKey}' },
            requiresApiKey: true,
            supportedChains: ['ethereum-sepolia', 'ethereum-mainnet'],
            defaultTimeout: 5000,
            defaultWeight: 150,
            defaultMaxRequestsPerSecond: 100
          }
        },
        chains: {
          'ethereum-sepolia': {
            strategy: 'round_robin',
            availableProviders: ['enterprise-node', 'alchemy'], // Mix custom and built-in
            defaultSettings: {
              weight: 50,
              timeout: 30000,
              maxRequestsPerSecond: 10
            }
          }
        }
      }

      const loader = new RPCConfigLoader(undefined, rpcKeys, config)
      const templates = await loader.loadProviderTemplates()
      
      const enterpriseTemplate = templates.find(t => t.name === 'enterprise-node')
      expect(enterpriseTemplate).toBeDefined()
      expect(enterpriseTemplate?.displayName).toBe('Enterprise Node')
      expect(enterpriseTemplate?.authType).toBe('header')
      
      console.log('✅ Custom provider loaded from customProviders (YAML-like)')
    })

    it('should allow customProviders to override built-in providers', async () => {
      const rpcKeys: RPCProviderKeys = {
        infura: 'my-infura-key'
      }

      const config: ConfigFormat = {
        customProviders: {
          'infura': {
            displayName: 'Infura Custom',
            authType: 'url_path',
            urlPattern: 'https://custom-infura.example.com/v3/{apiKey}',
            requiresApiKey: true,
            supportedChains: ['ethereum-sepolia'],
            defaultTimeout: 8000,
            defaultWeight: 120,
            defaultMaxRequestsPerSecond: 15
          }
        },
        chains: {
          'ethereum-sepolia': {
            strategy: 'failover',
            availableProviders: ['infura'],
            defaultSettings: {
              weight: 50,
              timeout: 30000,
              maxRequestsPerSecond: 10
            }
          }
        }
      }

      const loader = new RPCConfigLoader(undefined, rpcKeys, config)
      const templates = await loader.loadProviderTemplates()
      
      const infuraTemplate = templates.find(t => t.name === 'infura')
      expect(infuraTemplate).toBeDefined()
      expect(infuraTemplate?.displayName).toBe('Infura Custom')
      expect(infuraTemplate?.defaultTimeout).toBe(8000)
      
      console.log('✅ customProviders successfully overrode built-in infura provider')
    })
  })

  describe('4. Provider Priority System', () => {
    it('should respect priority: code > customProviders > built-in', async () => {
      const rpcKeys: RPCProviderKeys = {
        alchemy: 'test-key'
      }

      const config: ConfigFormat = {
        // Highest priority: code providers
        providers: {
          'alchemy': {
            displayName: 'Alchemy Code Override',
            authType: 'url_path',
            urlPattern: 'https://code-override.example.com/{apiKey}',
            requiresApiKey: true,
            supportedChains: ['ethereum-sepolia'],
            defaultTimeout: 20000,
            defaultWeight: 300,
            defaultMaxRequestsPerSecond: 30
          }
        },
        // Middle priority: customProviders (should be ignored for alchemy)
        customProviders: {
          'alchemy': {
            displayName: 'Alchemy Custom Override',
            authType: 'url_path',
            urlPattern: 'https://custom-override.example.com/{apiKey}',
            requiresApiKey: true,
            supportedChains: ['ethereum-sepolia'],
            defaultTimeout: 10000,
            defaultWeight: 200,
            defaultMaxRequestsPerSecond: 20
          }
        },
        // Built-in (lowest priority, should be ignored for alchemy)
        chains: {
          'ethereum-sepolia': {
            strategy: 'round_robin',
            availableProviders: ['alchemy'],
            defaultSettings: {
              weight: 50,
              timeout: 30000,
              maxRequestsPerSecond: 10
            }
          }
        }
      }

      const loader = new RPCConfigLoader(undefined, rpcKeys, config)
      const templates = await loader.loadProviderTemplates()
      
      const alchemyTemplate = templates.find(t => t.name === 'alchemy')
      expect(alchemyTemplate).toBeDefined()
      expect(alchemyTemplate?.displayName).toBe('Alchemy Code Override')
      expect(alchemyTemplate?.defaultTimeout).toBe(20000)
      expect(alchemyTemplate?.defaultWeight).toBe(300)
      
      console.log('✅ Code providers have highest priority (overrides customProviders and built-in)')
    })

    it('should use customProviders when code providers not specified', async () => {
      const rpcKeys: RPCProviderKeys = {
        alchemy: 'test-key'
      }

      const config: ConfigFormat = {
        // No code providers for alchemy
        customProviders: {
          'alchemy': {
            displayName: 'Alchemy Custom',
            authType: 'url_path',
            urlPattern: 'https://custom.example.com/{apiKey}',
            requiresApiKey: true,
            supportedChains: ['ethereum-sepolia'],
            defaultTimeout: 12000,
            defaultWeight: 180,
            defaultMaxRequestsPerSecond: 18
          }
        },
        chains: {
          'ethereum-sepolia': {
            strategy: 'round_robin',
            availableProviders: ['alchemy'],
            defaultSettings: {
              weight: 50,
              timeout: 30000,
              maxRequestsPerSecond: 10
            }
          }
        }
      }

      const loader = new RPCConfigLoader(undefined, rpcKeys, config)
      const templates = await loader.loadProviderTemplates()
      
      const alchemyTemplate = templates.find(t => t.name === 'alchemy')
      expect(alchemyTemplate).toBeDefined()
      expect(alchemyTemplate?.displayName).toBe('Alchemy Custom')
      expect(alchemyTemplate?.defaultTimeout).toBe(12000)
      
      console.log('✅ customProviders used when code providers not specified (overrides built-in)')
    })

    it('should use built-in when neither code nor customProviders specified', async () => {
      const rpcKeys: RPCProviderKeys = {
        alchemy: 'test-key'
      }

      const config: ConfigFormat = {
        // No custom configuration for alchemy
        chains: {
          'ethereum-sepolia': {
            strategy: 'round_robin',
            availableProviders: ['alchemy'],
            defaultSettings: {
              weight: 50,
              timeout: 30000,
              maxRequestsPerSecond: 10
            }
          }
        }
      }

      const loader = new RPCConfigLoader(undefined, rpcKeys, config)
      const templates = await loader.loadProviderTemplates()
      
      const alchemyTemplate = templates.find(t => t.name === 'alchemy')
      expect(alchemyTemplate).toBeDefined()
      expect(alchemyTemplate?.displayName).toBe('Alchemy') // Built-in display name
      expect(alchemyTemplate?.defaultTimeout).toBe(5000) // Built-in timeout
      
      console.log('✅ Built-in provider used when no custom configuration specified')
    })
  })

  describe('5. Mixed Configuration Scenarios', () => {
    it('should handle mix of built-in, customProviders, and code providers', async () => {
      const rpcKeys: RPCProviderKeys = {
        alchemy: 'alchemy-key',
        infura: 'infura-key',
        'custom-node': 'custom-key',
        'enterprise-node': 'enterprise-key'
      }

      const config: ConfigFormat = {
        // Code provider
        providers: {
          'custom-node': {
            displayName: 'Custom Node',
            authType: 'none',
            baseUrl: 'https://custom.example.com',
            requiresApiKey: false,
            supportedChains: ['ethereum-sepolia'],  // Use standard chain name
            defaultTimeout: 8000,
            defaultWeight: 120,
            defaultMaxRequestsPerSecond: 40
          }
        },
        // YAML customProvider
        customProviders: {
          'enterprise-node': {
            displayName: 'Enterprise Node',
            authType: 'header',
            urlPattern: 'https://enterprise.example.com',
            headerTemplate: { 'X-API-Key': '{apiKey}' },
            requiresApiKey: true,
            supportedChains: ['ethereum-sepolia'],  // Use standard chain name
            defaultTimeout: 6000,
            defaultWeight: 150,
            defaultMaxRequestsPerSecond: 80
          }
        },
        chains: {
          'ethereum-sepolia': {  // Use standard chain name
            strategy: 'round_robin',
            // Mix all three: code, customProviders, built-in
            availableProviders: ['custom-node', 'enterprise-node', 'alchemy', 'infura'],
            defaultSettings: {
              weight: 50,
              timeout: 30000,
              maxRequestsPerSecond: 10
            }
          }
        }
      }

      const loader = new RPCConfigLoader(undefined, rpcKeys, config)
      const globalConfig = await loader.loadGlobalConfig()

      const endpoints = globalConfig.chains['ethereum-sepolia'].endpoints
      expect(endpoints.length).toBe(4)
      expect(endpoints.some(e => e.provider === 'custom-node')).toBe(true)
      expect(endpoints.some(e => e.provider === 'enterprise-node')).toBe(true)
      expect(endpoints.some(e => e.provider === 'alchemy')).toBe(true)
      expect(endpoints.some(e => e.provider === 'infura')).toBe(true)

      console.log('✅ Successfully mixed code providers, customProviders, and built-in providers')
    })

    it('should filter out providers without API keys', async () => {
      const rpcKeys: RPCProviderKeys = {
        alchemy: 'alchemy-key'
        // infura key not provided
      }

      const config: ConfigFormat = {
        chains: {
          'ethereum-sepolia': {  // Use standard chain name
            strategy: 'round_robin',
            availableProviders: ['alchemy', 'infura'], // infura should be filtered out
            defaultSettings: {
              weight: 50,
              timeout: 30000,
              maxRequestsPerSecond: 10
            }
          }
        }
      }

      const loader = new RPCConfigLoader(undefined, rpcKeys, config)
      const globalConfig = await loader.loadGlobalConfig()

      const endpoints = globalConfig.chains['ethereum-sepolia'].endpoints
      expect(endpoints.length).toBe(1)
      expect(endpoints[0].provider).toBe('alchemy')

      console.log('✅ Filtered out providers without API keys')
    })

    it('should support public providers (no API key required)', async () => {
      const rpcKeys: RPCProviderKeys = {
        // No API keys provided
      }

      const config: ConfigFormat = {
        chains: {
          'ethereum-mainnet': {
            strategy: 'failover',
            availableProviders: ['publicnode', 'cloudflare'],
            defaultSettings: {
              weight: 50,
              timeout: 30000,
              maxRequestsPerSecond: 3
            }
          }
        }
      }

      const loader = new RPCConfigLoader(undefined, rpcKeys, config)
      const globalConfig = await loader.loadGlobalConfig()
      
      const endpoints = globalConfig.chains['ethereum-mainnet'].endpoints
      expect(endpoints.length).toBeGreaterThanOrEqual(1) // At least one public provider
      
      console.log(`✅ Public providers work without API keys (${endpoints.length} endpoints)`)
    })
  })

  describe('6. Configuration Validation', () => {
    it('should throw error when no providers available for chain', async () => {
      const rpcKeys: RPCProviderKeys = {
        // No keys provided
      }

      const config: ConfigFormat = {
        chains: {
          'ethereum-sepolia': {
            strategy: 'round_robin',
            availableProviders: ['alchemy', 'infura'], // Both require API keys
            defaultSettings: {
              weight: 50,
              timeout: 30000,
              maxRequestsPerSecond: 10
            }
          }
        }
      }

      const loader = new RPCConfigLoader(undefined, rpcKeys, config, true) // disablePublicProviders=true
      
      await expect(loader.loadGlobalConfig()).rejects.toThrow('No chains could be configured')
      
      console.log('✅ Throws error when no providers available')
    })

    it('should handle empty configuration gracefully', async () => {
      const rpcKeys: RPCProviderKeys = {
        alchemy: 'test-key'
      }

      const config: ConfigFormat = {
        chains: {
          'ethereum-sepolia': {
            strategy: 'round_robin',
            availableProviders: ['alchemy'],
            defaultSettings: {
              weight: 50,
              timeout: 30000,
              maxRequestsPerSecond: 10
            }
          }
        }
      }

      const loader = new RPCConfigLoader(undefined, rpcKeys, config)
      const templates = await loader.loadProviderTemplates()
      
      expect(templates.length).toBeGreaterThan(0)
      
      console.log('✅ Handled empty custom configuration gracefully')
    })
  })
})
