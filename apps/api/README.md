# PayIn Web Server

Web server application with REST API and UI for managing PayIn payment operations.

## Architecture

```
Web Server (Hono)
    ↓
ConfigurationManager (Facade)
    ↓
Processor → Monitor
```

**Key Design Principles:**
- Web Server ONLY interacts with `ConfigurationManager`
- Manager acts as unified facade for configuration + business operations
- Manager internally manages Processor instance and proxies all operations

## Features

- **Configuration Management**: Manage system configurations through UI and API
- **Order Payment Service**: Create and manage payment orders
- **User Deposit Service**: Bind addresses and manage user deposits
- **Transfer Monitoring**: View blockchain transaction records
- **Address Pool Management**: Monitor and manage payment addresses

## Directory Structure

```
app/
├── src/
│   ├── index.ts              # Application entry point
│   ├── server.ts             # Hono server setup
│   ├── manager-instance.ts   # Manager singleton
│   └── config.ts             # Configuration loader
├── config/
│   ├── app.yaml              # Application configuration
│   └── manager.yaml          # Manager configuration
├── package.json
├── tsconfig.json
└── README.md
```

## Configuration

### app.yaml

Application-level configuration:
- Server port and host
- Database connection string
- Manager config file path
- Processor overrides (optional)

### manager.yaml

Manager configuration metadata:
- Configuration item definitions
- Default values
- Validation rules
- Data types

## Getting Started

### Prerequisites

- Node.js >= 18
- PostgreSQL database
- PayIn packages: `@payin/manager`, `@payin/processor`

### Installation

```bash
# Install dependencies (from project root)
npm install
```

### Running

```bash
# Development mode with auto-reload
cd app
npm run dev

# Production build
npm run build
npm start
```

### Health Check

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-18T10:30:00.000Z",
  "manager": {
    "initialized": true,
    "processorStarted": true
  },
  "database": {
    "connected": true
  }
}
```

## API Endpoints

### Phase 1: Health Check (Current)
- `GET /health` - System health status

### Phase 2: Configuration Management (Planned)
- `GET /api/v1/config` - List all configurations
- `GET /api/v1/config/:key` - Get specific configuration
- `PUT /api/v1/config/:key` - Update configuration
- `POST /api/v1/config/init` - Initialize default configurations

### Phase 3: Business Operations (Planned)
- `POST /api/v1/orders` - Create order
- `GET /api/v1/orders` - List orders (with filtering)
- `GET /api/v1/orders/:id` - Get order details
- `GET /api/v1/orders/stats` - Get order statistics
- `POST /api/v1/deposits/bind` - Bind deposit address
- `POST /api/v1/deposits/unbind` - Unbind deposit address
- `GET /api/v1/deposits` - List deposit addresses
- `GET /api/v1/transfers` - List transfer records

## Development Roadmap

- [x] **Phase 1**: Basic infrastructure ← Current
- [ ] **Phase 2**: Configuration management API
- [ ] **Phase 3**: Business operations API
- [ ] **Phase 4**: Basic UI framework
- [ ] **Phase 5**: Advanced features

## Technology Stack

- **Framework**: Hono (lightweight web framework)
- **Runtime**: Node.js
- **Language**: TypeScript
- **Database**: PostgreSQL (via Manager)
- **Business Logic**: ConfigurationManager → Processor → Monitor

## License

MIT
