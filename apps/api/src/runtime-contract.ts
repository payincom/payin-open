import type { Hono } from 'hono';
import type { getManager } from './manager-instance.js';
import type { cloudOnlyRouteGuard } from './open-runtime.js';
import type { createApiKeysRoutes, ApiKeysRouteDependencies } from './routes/api-keys.js';
import type { createOrdersRoutes, OrdersRouteDependencies } from './routes/orders.js';
import type { createDepositsRoutes, DepositsRouteDependencies } from './routes/deposits.js';
import type { createTransfersRoutes, TransfersRouteDependencies } from './routes/transfers.js';
import type { createAddressPoolRoutes, AddressPoolRouteDependencies } from './routes/address-pool.js';
import type { createPaymentLinksRoutes, PaymentLinksRouteDependencies } from './routes/payment-links.js';
import type { createNotificationsRoutes, NotificationsRouteDependencies } from './routes/notifications.js';

export type {
  OrderCreateEventEnvelope,
  OrderCreateEventSink,
  OrderCreatePolicy,
  OrderCreatePolicyDecision,
  OrderCreatePolicyInput,
  OrderCreatePolicyRequest,
} from './order-create-seam.js';
export type {
  PaymentLinkCreatePolicyRequest,
  PaymentLinkCurrencyPolicyRequest,
  PaymentLinkEventEnvelope,
  PaymentLinkEventSink,
  PaymentLinkPolicy,
  PaymentLinkPolicyDecision,
  PaymentLinkPolicyInput,
  PaymentLinkPolicyOperation,
  PaymentLinkPolicyRequest,
  PaymentLinkPublishPolicyRequest,
  PaymentLinkUpdatePolicyRequest,
} from './payment-link-seam.js';
export type {
  NotificationEndpointPolicyRequest,
  NotificationEventEnvelope,
  NotificationEventSink,
  NotificationPolicy,
  NotificationPolicyDecision,
  NotificationPolicyInput,
  NotificationPolicyOperation,
  NotificationPolicyRequest,
  NotificationRetryPolicyRequest,
} from './notification-seam.js';

export const PAYIN_OPEN_RUNTIME_CONTRACT = {
  name: 'payin-open-runtime-composition',
  version: '1.0.0',
  packageName: '@payin/app',
  exportPath: '@payin/app/runtime-contract',
  stability: 'stable',
  owner: 'payin-open',
  consumer: 'payin-cloud-layer',
  surfaces: [
    'managerProvider',
    'cloudOnlyRouteGuard',
    'routeFactories',
    'routeDependencies',
    'extensionHooks',
    'policySeams',
  ],
} as const;

export type PayInOpenRuntimeContract = typeof PAYIN_OPEN_RUNTIME_CONTRACT;
export type PayInOpenRuntimeContractVersion = PayInOpenRuntimeContract['version'];
export type PayInOpenRuntimeContractSurface = PayInOpenRuntimeContract['surfaces'][number];

export type OpenManagerProvider = typeof getManager;
export type OpenCloudOnlyRouteGuard = typeof cloudOnlyRouteGuard;
export type OpenRuntimeExtensionHook = (app: Hono) => void;

export type OpenApiKeysRouteDependencies = ApiKeysRouteDependencies;
export type OpenOrdersRouteDependencies = OrdersRouteDependencies;
export type OpenPaymentLinksRouteDependencies = PaymentLinksRouteDependencies;
export type OpenDepositsRouteDependencies = DepositsRouteDependencies;
export type OpenAddressPoolRouteDependencies = AddressPoolRouteDependencies;
export type OpenTransfersRouteDependencies = TransfersRouteDependencies;
export type OpenNotificationsRouteDependencies = NotificationsRouteDependencies;

export interface OpenRuntimeRouteFactories {
  apiKeys?: typeof createApiKeysRoutes;
  orders?: typeof createOrdersRoutes;
  paymentLinks?: typeof createPaymentLinksRoutes;
  deposits?: typeof createDepositsRoutes;
  addressPool?: typeof createAddressPoolRoutes;
  transfers?: typeof createTransfersRoutes;
  notifications?: typeof createNotificationsRoutes;
}

export interface OpenRuntimeRouteDependencies {
  apiKeys?: OpenApiKeysRouteDependencies;
  orders?: OpenOrdersRouteDependencies;
  paymentLinks?: OpenPaymentLinksRouteDependencies;
  deposits?: OpenDepositsRouteDependencies;
  addressPool?: OpenAddressPoolRouteDependencies;
  transfers?: OpenTransfersRouteDependencies;
  notifications?: OpenNotificationsRouteDependencies;
}

export interface OpenRuntimeCompositionOptions {
  getManager?: OpenManagerProvider;
  cloudOnlyRouteGuard?: OpenCloudOnlyRouteGuard;
  routeFactories?: OpenRuntimeRouteFactories;
  routeDependencies?: OpenRuntimeRouteDependencies;
  extendPublicRoutes?: OpenRuntimeExtensionHook;
  extendApiRoutes?: OpenRuntimeExtensionHook;
}
