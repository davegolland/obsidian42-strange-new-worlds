# Backend Integration

> **📚 Comprehensive API Documentation**: For complete API documentation including all endpoints, request/response formats, and examples, see the backend's [API_DOCUMENTATION.md](../../obs-plugin-backend/API_DOCUMENTATION.md).

This plugin now supports connecting to an external backend service to provide AI-powered link suggestions. The backend integration allows you to get intelligent link recommendations based on the content of your notes.

## Features

- **Zero-config setup**: Automatically registers your vault with the backend on plugin load
- **Smart link suggestions**: Get contextual link recommendations with reasons
- **Graceful fallback**: Returns empty results if backend is unavailable (no UI blocking)
- **Status monitoring**: Shows when the backend is ready to provide suggestions
- **Easy toggle**: Enable/disable backend integration via settings

## Setup

### 1. Backend Server

You need a running backend server that implements the following API endpoints:

- `POST /register` - Register a vault path
- `GET /status` - Get backend status
- `POST /query/related` - Get related links for a file

### 2. Plugin Configuration

1. Open Obsidian Settings
2. Go to "Strange New Worlds" plugin settings
3. Scroll to "Backend Integration" section
4. Enable "Enable backend inferred links"
5. Set the "Backend base URL" (default: `http://localhost:8000`)

## API Contract

### Register Vault
```http
POST /register
Content-Type: application/json

{
  "vault_path": "/path/to/your/vault"
}
```

**Response:** `200 OK` or `202 Accepted`

### Get Status
```http
GET /status
```

**Response:**
```json
{
  "ready": true,
  "vaultPath": "/path/to/your/vault",
  "files": 1234,
  "apiVersion": "1.0.0",
  "commit": "abc123"
}
```

### Query Related Links
```http
POST /query/related
Content-Type: application/json

{
  "file": "path/to/file.md",
  "k": 10
}
```

**Response:**
```json
{
  "items": [
    {
      "path": "related-file.md",
      "reason": "Similar topic discussed",
      "score": 0.85
    }
  ]
}
```

**Error Response (503):** Backend is warming up, plugin will retry later

## How It Works

1. **Plugin Load**: Automatically registers your vault with the backend
2. **Status Polling**: Checks backend readiness and shows notification when ready
3. **Link Provider**: Registers a virtual link provider that calls the backend for suggestions
4. **Graceful Handling**: Returns empty results on errors to avoid blocking the UI

## Testing

### Test Your Backend

Run the test script to verify your backend is working:

```bash
node scripts/test-backend-integration.js
```

### Example Backend Server

For testing purposes, you can run the included example backend server:

```bash
node scripts/example-backend-server.js
```

This will start a mock server on `http://localhost:8000` that:
- Simulates a 3-second warmup period
- Returns mock link suggestions
- Implements all required API endpoints
- Shows the expected request/response flow

## Troubleshooting

### Backend Not Responding
- Check if your backend server is running
- Verify the base URL in settings
- Check browser console for connection errors

### No Link Suggestions
- Ensure backend is returning `ready: true` in status
- Check that `/query/related` returns valid results
- Verify file paths are relative to vault root

### Performance Issues
- Backend suggestions are cached and don't block typing
- Empty results are returned quickly on errors
- Status polling is non-blocking

## Development

The backend integration is implemented in:

- `src/backend/types.ts` - Type definitions
- `src/backend/client.ts` - API client with retry logic
- `src/backend/provider.ts` - Virtual link provider
- `src/main.ts` - Integration with main plugin
- `src/settings.ts` - Configuration options
- `src/ui/SettingsTab.ts` - Settings UI

The integration follows the existing plugin patterns and maintains backward compatibility.
