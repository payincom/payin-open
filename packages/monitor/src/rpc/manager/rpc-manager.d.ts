import { EventEmitter } from 'events';
import { RPCGlobalConfig, RPCEndpointInstance, RPCMetrics, ConfigFormat } from '../types/rpc-config.js';
import { HealthCheckResult } from './health-checker.js';
export interface RPCRequest {
    method: string;
    params: any[];
    id?: string | number;
}
export interface RPCResponse {
    jsonrpc: '2.0';
    id: string | number;
    result?: any;
    error?: {
        code: number;
        message: string;
        data?: any;
    };
}
export interface RPCManagerOptions {
    rpcKeys?: Record<string, string>;
    configPath?: string;
    rpcConfig?: ConfigFormat | RPCGlobalConfig;
    enableRetry?: boolean;
    enableRateLimit?: boolean;
    enableHealthCheck?: boolean;
    disablePublicProviders?: boolean;
}
export declare class RPCManager extends EventEmitter {
    private options;
    private config;
    private endpoints;
    private loadBalancers;
    private healthChecker;
    private rateLimiter;
    private configLoader;
    private providerTemplates;
    private isInitialized;
    private readonly logger;
    constructor(options: RPCManagerOptions);
    initialize(): Promise<void>;
    makeRequest(chain: string, request: RPCRequest): Promise<any>;
    getChainEndpoints(chain: string): Promise<RPCEndpointInstance[]>;
    getHealthyEndpoints(chain: string): Promise<RPCEndpointInstance[]>;
    getEndpointMetrics(chain?: string): Promise<RPCMetrics[]>;
    private createMetricsFromEndpoint;
    testEndpoint(chain: string, endpointName: string): Promise<HealthCheckResult>;
    reloadConfiguration(newConfig?: RPCGlobalConfig): Promise<void>;
    getConfiguration(): RPCGlobalConfig;
    stop(): Promise<void>;
    private isRPCGlobalConfig;
    private loadConfiguration;
    private setupEndpoints;
    private setupLoadBalancers;
    private setupHealthCheckEvents;
    private executeRequest;
    private getChainConfig;
    private isNetworkError;
    private sleep;
    request(chain: string, request: RPCRequest): Promise<RPCResponse>;
}
//# sourceMappingURL=rpc-manager.d.ts.map