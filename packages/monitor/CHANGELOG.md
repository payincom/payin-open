# Monitor Changelog

## [Unreleased]

### Fixed
- **[2025-10-09] Idle Chain Height Tracking**: Fixed issue where monitor would stop updating chain height (`lastProcessedBlock`) when no monitoring targets are active
  - **Problem**: Long idle periods caused significant block scanning delays when new orders/deposits were created
  - **Solution**: Monitor now continues lightweight chain height tracking even without active targets
  - **Impact**: Eliminates 30-60 second delays in payment detection after idle periods
  - **Details**: See [IDLE_TRACKING_FIX.md](./IDLE_TRACKING_FIX.md)

## Previous Changes

See git history for detailed change log.
