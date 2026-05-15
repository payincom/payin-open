import { EventEmitter } from 'events';
import { RPCEndpointInstance, RPCMetrics } from '../types/rpc-config.js';
export interface HealthCheckResult {
    endpoint: RPCEndpointInstance;
    isHealthy: boolean;
    responseTime: number;
    error?: string;
}
export interface HealthCheckOptions {
    enabled: boolean;
    interval: number;
    timeout: number;
    maxFailures: number;
}
export declare class HealthChecker extends EventEmitter {
    private options;
    private intervals;
    private metrics;
    constructor(options: HealthCheckOptions);
    startMonitoring(endpoints: RPCEndpointInstance[]): void;
    stopMonitoring(endpointId?: string): void;
    checkEndpoint(endpoint: RPCEndpointInstance): Promise<HealthCheckResult>;
    getMetrics(endpointId: string): RPCMetrics | undefined;
    getAllMetrics(): RPCMetrics[];
    clearMetrics(endpointId?: string): void;
    private startEndpointMonitoring;
    private updateEndpointHealth;
    private updateMetrics;
    private getEndpointById;
}
//# sourceMappingURL=health-checker.d.ts.map