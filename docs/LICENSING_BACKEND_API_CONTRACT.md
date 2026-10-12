# Licensing Backend API Contract

This document defines an example backend contract for a production licensing service. It is intentionally implementation-agnostic and can be used with any backend stack.

## General Notes

- All examples use JSON over HTTPS.
- Authentication strategy is not prescribed here.
- Field names are aligned with the starter licensing contracts.
- Timestamps should use ISO 8601 UTC strings.
- The backend may return additional fields, but the documented fields should remain stable.

## Status Values

Supported `status` values:

- `unlicensed`
- `active`
- `grace-period`
- `degraded`
- `expired`
- `invalid`
- `revoked`

Supported degraded mode values:

- `none`
- `readonly`
- `limited`
- `blocked`

## POST /activate

Activates a license key for a device or installation.

Example request:

```json
{
  "key": "LIC-123-ABC-999",
  "deviceName": "Workstation-01"
}
```

Example response:

```json
{
  "success": true,
  "status": "active",
  "activatedAt": "2026-03-27T12:00:00.000Z",
  "entitlements": {
    "items": [
      {
        "key": "starter.pro",
        "name": "Starter Pro",
        "enabled": true,
        "limit": null
      }
    ]
  },
  "gracePeriod": {
    "active": false,
    "startedAt": null,
    "endsAt": null,
    "remainingDays": 7
  },
  "degradedMode": {
    "active": false,
    "mode": "none",
    "reason": null
  }
}
```

Failure example:

```json
{
  "success": false,
  "status": "invalid",
  "activatedAt": null,
  "entitlements": {
    "items": []
  },
  "gracePeriod": {
    "active": false,
    "startedAt": null,
    "endsAt": null,
    "remainingDays": 0
  },
  "degradedMode": {
    "active": true,
    "mode": "readonly",
    "reason": "License key is invalid."
  }
}
```

## POST /validate

Validates a license state against the backend.

Example request:

```json
{
  "key": "LIC-123-ABC-999",
  "lastValidatedAt": "2026-03-27T10:00:00.000Z"
}
```

Example response:

```json
{
  "valid": true,
  "status": "active",
  "validatedAt": "2026-03-27T12:05:00.000Z",
  "entitlements": {
    "items": [
      {
        "key": "starter.pro",
        "name": "Starter Pro",
        "enabled": true,
        "limit": null
      }
    ]
  },
  "gracePeriod": {
    "active": false,
    "startedAt": null,
    "endsAt": null,
    "remainingDays": 7
  },
  "degradedMode": {
    "active": false,
    "mode": "none",
    "reason": null
  }
}
```

Expired example:

```json
{
  "valid": false,
  "status": "expired",
  "validatedAt": "2026-03-27T12:05:00.000Z",
  "entitlements": {
    "items": []
  },
  "gracePeriod": {
    "active": false,
    "startedAt": null,
    "endsAt": null,
    "remainingDays": 0
  },
  "degradedMode": {
    "active": true,
    "mode": "limited",
    "reason": "License has expired."
  }
}
```

## POST /heartbeat

Reports an active installation and keeps the license session alive.

Example request:

```json
{
  "key": "LIC-123-ABC-999",
  "installationId": "f24c8f6d-799f-4d66-a355-78b97b7f6498",
  "lastHeartbeatAt": "2026-03-27T11:30:00.000Z"
}
```

Example response:

```json
{
  "ok": true,
  "status": "active",
  "heartbeatAt": "2026-03-27T12:10:00.000Z",
  "gracePeriod": {
    "active": false,
    "startedAt": null,
    "endsAt": null,
    "remainingDays": 7
  },
  "degradedMode": {
    "active": false,
    "mode": "none",
    "reason": null
  }
}
```

Server-unavailable fallback example:

```json
{
  "ok": false,
  "status": "grace-period",
  "heartbeatAt": null,
  "gracePeriod": {
    "active": true,
    "startedAt": "2026-03-26T12:10:00.000Z",
    "endsAt": "2026-04-02T12:10:00.000Z",
    "remainingDays": 6
  },
  "degradedMode": {
    "active": false,
    "mode": "none",
    "reason": null
  }
}
```

## GET /entitlements

Returns the current entitlements for a license.

This may also be implemented as `POST /entitlements` if the backend prefers request bodies over query parameters.

Example request:

`GET /entitlements?key=LIC-123-ABC-999`

Example response:

```json
{
  "status": "active",
  "entitlements": {
    "items": [
      {
        "key": "starter.pro",
        "name": "Starter Pro",
        "enabled": true,
        "limit": null
      },
      {
        "key": "seats",
        "name": "Seats",
        "enabled": true,
        "limit": 10
      }
    ]
  },
  "degradedMode": {
    "active": false,
    "mode": "none",
    "reason": null
  }
}
```

## Suggested HTTP Semantics

Example status code mapping:

- `200` for successful activation, validation, heartbeat, and entitlement reads
- `400` or `422` for invalid request or invalid license
- `402` for expired license
- `403` for revoked license
- `503` for temporary backend unavailability

The desktop client should still rely on response payload fields for business logic, not only on status codes.
