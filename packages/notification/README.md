# @payin/notification

Notification service for PayIn with webhook, email and telegram support.

## Status

🚧 **Phase 1 Implementation** - Basic webhook functionality

### Completed ✅
- Package structure
- Database schema
- Type definitions
- HMAC signature utilities
- Retry strategy (exponential backoff)
- Event mapper
- WebhookNotifier

### In Progress 🔄
- NotificationRepository
- NotificationQueue
- NotificationService
- Manager integration

### Planned 📋
- Email notifier (Phase 2)
- Telegram notifier (Phase 2)
- Full test coverage

## Installation

```bash
cd packages/notification
npm install
```

## Database Setup

The notification service uses the same PostgreSQL database as Processor and Manager.

```typescript
import { ALL_SCHEMAS } from '@payin/notification';

// Create tables
for (const schema of ALL_SCHEMAS) {
  await db.query(schema);
}
```

## Usage

```typescript
import { NotificationService } from '@payin/notification';

// Create service
const notification = await NotificationService.create({
  database: {
    connectionString: process.env.DATABASE_URL
  }
});

// Start service
await notification.start();

// Send notification
await notification.sendNotification({
  id: 'evt_order_completed_ord_123',
  type: 'order.completed',
  created_at: new Date().toISOString(),
  data: {
    order_id: 'ord_123',
    amount: '100.00',
    currency: 'USDT'
  }
});
```

## Documentation

See [docs/notification.md](../../docs/notification.md) for complete documentation.
