import { RPCEndpointInstance } from '../types/rpc-config.js';
export interface LoadBalancerStrategy {
    selectEndpoint(endpoints: RPCEndpointInstance[]): RPCEndpointInstance | null;
    onRequestSuccess(endpoint: RPCEndpointInstance, responseTime: number): void;
    onRequestFailure(endpoint: RPCEndpointInstance, error: string): void;
    reset(): void;
}
export declare class RoundRobinStrategy implements LoadBalancerStrategy {
    private currentIndex;
    private readonly logger;
    selectEndpoint(endpoints: RPCEndpointInstance[]): RPCEndpointInstance | null;
    onRequestSuccess(endpoint: RPCEndpointInstance, responseTime: number): void;
    onRequestFailure(endpoint: RPCEndpointInstance, error: string): void;
    reset(): void;
    private expandByWeight;
}
export declare class FailoverStrategy implements LoadBalancerStrategy {
    selectEndpoint(endpoints: RPCEndpointInstance[]): RPCEndpointInstance | null;
    onRequestSuccess(endpoint: RPCEndpointInstance, responseTime: number): void;
    onRequestFailure(endpoint: RPCEndpointInstance, error: string): void;
    reset(): void;
}
export declare class FastestStrategy implements LoadBalancerStrategy {
    private performanceWindow;
    private readonly windowSize;
    selectEndpoint(endpoints: RPCEndpointInstance[]): RPCEndpointInstance | null;
    onRequestSuccess(endpoint: RPCEndpointInstance, responseTime: number): void;
    onRequestFailure(endpoint: RPCEndpointInstance, error: string): void;
    reset(): void;
    private recordResponseTime;
    private getAverageResponseTime;
}
export declare class LoadBalancer {
    private strategy;
    constructor(strategyType: 'round_robin' | 'failover' | 'fastest');
    selectEndpoint(endpoints: RPCEndpointInstance[]): RPCEndpointInstance | null;
    onRequestSuccess(endpoint: RPCEndpointInstance, responseTime: number): void;
    onRequestFailure(endpoint: RPCEndpointInstance, error: string): void;
    changeStrategy(strategyType: 'round_robin' | 'failover' | 'fastest'): void;
    reset(): void;
    private createStrategy;
}
//# sourceMappingURL=load-balancer.d.ts.map