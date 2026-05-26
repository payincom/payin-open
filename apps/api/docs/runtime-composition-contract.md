# PayIn Open Runtime Composition Contract

PayIn Open owns the payment core and publishes a small runtime composition contract for hosted overlays.
The stable consumer entrypoint is `@payin/app/runtime-contract`; `@payin/app/server` remains the app factory entrypoint for `createApp`.

## Open-owned

- Payment processing, manager, auth, storage, route implementations, and default self-hosted runtime behavior.
- The contract metadata `PAYIN_OPEN_RUNTIME_CONTRACT`, currently version `1.0.0`.
- Exported types for manager provider, Cloud-only route guard, route factories, route dependencies, extension hooks, and policy seams.
- Backward-compatible evolution of the stable contract surface.

## Cloud-owned

- Hosted policy decisions, tenant/auth/entitlement evaluation, Cloud status/admin/control-plane routes, and Cloud runtime health overlay.
- Composition of Open through `createApp` and the explicit `@payin/app/runtime-contract` types.
- No copies or forks of Open payment core internals.

## Shared Contract

The shared surface is limited to runtime composition: `OpenRuntimeCompositionOptions`, route dependency types, extension hooks, policy seam types, and `PAYIN_OPEN_RUNTIME_CONTRACT` metadata.
Cloud may import `createApp` from `@payin/app/server`, but should not derive consumer types from broad `CreateAppOptions` internals.

## Versioning And Evolution

- Additive type exports and optional fields can stay within the current major version.
- Removing fields, changing route mount semantics, or changing policy decision shapes requires a major contract version bump and Cloud migration.
- Open provider tests must prove the contract metadata exists; Cloud consumer checks must prove only allowed Open imports are used.

## Release Packaging Follow-up

Current local development still uses a sibling file dependency for `@payin/app`.
Before independent releases, publish or package the Open API artifact so Cloud can depend on an immutable version rather than a local path.
