# OpenProcessor Facade

`OpenProcessor` is the PayIn Open-facing facade over the existing lower-level `Processor`.

Its purpose is to make PayIn Open feel like a single-merchant self-hosted system while preserving compatibility with the current database and processor internals, which still store an `organization_id` for PayIn Cloud and historical reasons.

## Why it exists

The current processor contains useful payment, deposit, address-pool, and chain-monitoring logic, but some methods require explicit `organizationId` parameters. That is correct for PayIn Cloud's multi-tenant hosted service, but it is not the right public model for PayIn Open.

PayIn Open users should operate one self-hosted payment gateway for their own business. They should not need to understand tenant isolation, organization switching, hosted onboarding, or SaaS account boundaries.

## Public model

Open code should prefer:

```ts
import { OpenProcessor } from '@payin/processor';

const processor = await OpenProcessor.create();
await processor.initializeDatabaseSchema({ onlyMissing: true });
await processor.start();

await processor.createOrder({
  orderReference: 'merchant-order-1001',
  amount: '10',
  currency: 'USDC',
  chainId: 'ethereum-sepolia',
});

await processor.addAddressesToPool([
  { address: '0x0000000000000000000000000000000000000001', protocol: 'evm' },
]);

const stats = await processor.getAddressPoolAvailability('evm');
```

Instead of passing explicit organization context through every operation.

The Open-facing request types intentionally omit `organizationId`:

- `OpenCreateOrderRequest`
- `OpenBindAddressRequest`
- `OpenUnbindAddressRequest`

`OpenProcessor` injects the internal compatibility organization id before delegating to the lower-level processor. This keeps Open setup, Skill, CLI, and API wrappers single-merchant by default while preserving compatibility with the current persistence layer.


## Database setup

For self-hosted setup flows, call:

```ts
await processor.initializeDatabaseSchema({ onlyMissing: true });
```

`OpenProcessor` delegates schema creation to the lower-level processor and then idempotently creates the internal merchant organization row. This prevents self-hosted address-pool and order flows from failing on foreign-key constraints while keeping `organizationId` out of the Open-facing API.

## Compatibility model

Internally, the facade injects `DEFAULT_OPEN_ORGANIZATION_ID` for operations that still need an organization scope in the lower-level processor or database layer.

This is intentionally a compatibility layer, not the final domain model. The long-term target is to extract processor domain logic from tenant persistence/adapters, then keep:

- a single-merchant adapter for PayIn Open;
- a multi-tenant adapter for PayIn Cloud.

## Boundary rule

- PayIn Open application, Skill, CLI, and docs should use `OpenProcessor` when possible.
- PayIn Cloud may continue to use `Processor` directly with explicit organization context.
- New Open-facing APIs should not require `organizationId` unless they are explicitly internal compatibility code.

## Tests

The facade is covered by:

```bash
npm run test:unit -- packages/processor/tests/unit/open-processor-facade.test.ts
```

The full Open verification gate is:

```bash
npm run open:verify
```

## Open and Cloud runtime adapters

The processor package exposes the Open runtime adapter and shared scope
terminology. Cloud runtime adapters must live outside this Open repository, for
example in the separate `payin-cloud-layer` repository.

- `OpenProcessor`: single-merchant, self-hosted boundary. It uses a
  `PaymentScope` with `kind: 'single-merchant'` and injects the internal Open
  merchant id.
- External Cloud layer adapters: hosted SaaS boundary. They use a `PaymentScope`
  with `kind: 'tenant'` and require an explicit tenant/organization id at their
  construction boundary.

This keeps Open and Cloud as separate adapters over shared payment functionality:

```text
Open API / Skill / CLI -> OpenManager / OpenProcessor -> shared processor compatibility layer
Cloud layer repo       -> Cloud adapter / Cloud extensions -> shared processor compatibility layer
```

The current database column is still named `organization_id` for compatibility.
Treat it as the storage key for `PaymentScope.id`; do not expose it from
Open-facing APIs.

## Open Manager facade

`@payin/manager` also exports `OpenManager` for API/Skill/CLI layers that need
manager-level functionality without tenant parameters:

```ts
import { OpenManager } from '@payin/manager';

const openManager = new OpenManager(manager);
await openManager.createOrder({
  orderReference: 'merchant-order-1001',
  amount: '10',
  currency: 'USDC',
  chainId: 'ethereum-sepolia',
});
```

Open-facing application code should prefer `OpenManager` over direct
`ConfigurationManager` business methods whenever the caller should not see or
choose tenant context.
