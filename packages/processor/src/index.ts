// === PayIn Payment System - 统一入口 ===

// 🚀 统一支付系统入口
export { Processor, ProcessorEventName } from './processor.js';
export type { ProcessorConfig, SystemStatus, EventHandler } from './processor.js';

// Defaults for Manager initialization
export { getDefaults } from './defaults.js';
export type {
  ProcessorDefaults,
  ChainDefault,
  TokenDefault,
  TokenChainDefault,
  OperationalConfigDefault
} from './defaults.js';

// Configuration loader (used by Manager/API for diagnostics)
export { loadConfig } from './core/config-loader.js';


// 业务接口类型 - 常用接口统一导出
export type {
  CreateOrderRequest,
  CreateOrderResponse,
  OrderStatusEvent,
  OrderStatus
} from './services/order-service.js';

export type {
  BindAddressRequest,
  BindAddressResponse,
  DepositEvent,
  UnbindAddressRequest
} from './services/deposit-service.js';

// 事件系统类型
export type {
  SystemEvent,
  ErrorEvent,
  TransferDetectedEvent,
  TransferConfirmedEvent,
  EventSubscription
} from './core/processor-event-bus.js';

// 核心组件

// Monitor相关类型现在从@payin/monitor导入
export type { MonitoringTarget, TransferEvent, MonitorConfig } from '@payin/monitor';

// Chain configuration
export type { Protocol, ChainId } from './config/chain-config.js';
export { getProtocol, isSupportedChain, getAllSupportedChains, getChainsByProtocol, isEVMChain, isTronChain } from './config/chain-config.js';

// 数据库相关导出
export { PostgreSQLDatabase } from './database/database.js';

// 业务服务 (直接导出，避免重复)
export { OrderService } from './services/order-service.js';
export { DepositService } from './services/deposit-service.js';

// 共享工具模块
export {
  AmountUtils,
  ChainUtils,
  ValidationUtils,
  ErrorUtils,
  ProcessorError,
  ValidationError,
  DatabaseError,
  NetworkError,
  BlockchainError,
  BusinessLogicError,
  ServiceUnavailableError,
  ResourceNotFoundError,
  ErrorCategory,
  ErrorSeverity
} from './shared/index.js';
