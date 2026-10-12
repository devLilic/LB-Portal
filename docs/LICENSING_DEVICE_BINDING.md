# Licensing Device Binding Contract

This document defines the expected backend behavior for machine binding, installation binding, and anti-clone licensing decisions.

The contract is implementation-agnostic. Any backend stack may implement it as long as the documented request/response semantics remain stable.

## Scope

- Bind a license to a specific machine and installation.
- Allow normal restarts on the same installation.
- Detect copied installs on different machines.
- Avoid destructive side effects against the legitimate original installation.
- Support explicit reauthorization for legitimate migration to a new computer.

## Core Terms

- `machineId`: Stable hashed identifier derived on the desktop app from machine-level inputs.
- `installationId`: Random local installation identifier generated once and reused by the same installation.
- `activationId`: Backend-issued identifier for the current activation binding.
- `activationToken`: Backend-issued token associated with the activation session.
- `fingerprintVersion`: Version of the machine fingerprinting strategy used by the client.

## General Rules

- All examples use JSON over HTTPS.
- Timestamps should use ISO 8601 UTC strings.
- The backend may add fields, but documented fields should remain stable.
- The client must never send raw machine fingerprint inputs. It sends only derived binding fields.

## Supported Reason Codes

- `none`
- `server_unavailable`
- `invalid_license`
- `expired`
- `revoked`
- `device_limit_exceeded`
- `device_mismatch`
- `clone_suspected`
- `reauthorization_required`

## POST /activate

Creates a first activation binding for a valid license on the current machine and installation.

Example request:

```json
{
  "key": "LIC-123-ABC-999",
  "deviceName": "Workstation-01",
  "device": {
    "machineId": "e0f0d8d4f7c3d0f5a0a1b2c3d4e5f67890abcdef1234567890abcdef12345678",
    "installationId": "8b8e52a4-4dc5-4f44-8c95-7d5ef8d4c120",
    "fingerprintVersion": "machine-v1",
    "appId": "default-electron-app",
    "appVersion": "2.2.0"
  }
}
```

Successful response example:

```json
{
  "success": true,
  "status": "active",
  "licenseStatus": "active",
  "activationId": "act_01HXYZ123",
  "activationToken": "tok_live_01HXYZ123",
  "activatedAt": "2026-03-27T12:00:00.000Z",
  "graceUntil": null,
  "reasonCode": "none",
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

Device limit example:

```json
{
  "success": false,
  "status": "degraded",
  "licenseStatus": "degraded",
  "activationId": null,
  "activationToken": null,
  "activatedAt": null,
  "graceUntil": null,
  "reasonCode": "device_limit_exceeded",
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
    "reason": "Device limit exceeded."
  }
}
```

## POST /validate

Validates an existing activation binding at startup or on explicit validation.

Example request:

```json
{
  "key": "LIC-123-ABC-999",
  "lastValidatedAt": "2026-03-27T10:00:00.000Z",
  "device": {
    "machineId": "e0f0d8d4f7c3d0f5a0a1b2c3d4e5f67890abcdef1234567890abcdef12345678",
    "installationId": "8b8e52a4-4dc5-4f44-8c95-7d5ef8d4c120",
    "fingerprintVersion": "machine-v1",
    "appId": "default-electron-app",
    "appVersion": "2.2.0"
  }
}
```

Successful response example:

```json
{
  "valid": true,
  "status": "active",
  "licenseStatus": "active",
  "activationId": "act_01HXYZ123",
  "activationToken": "tok_live_01HXYZ123",
  "validatedAt": "2026-03-27T12:05:00.000Z",
  "graceUntil": null,
  "reasonCode": "none",
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

Mismatch example:

```json
{
  "valid": false,
  "status": "degraded",
  "licenseStatus": "degraded",
  "activationId": "act_01HXYZ123",
  "activationToken": null,
  "validatedAt": "2026-03-27T12:05:00.000Z",
  "graceUntil": null,
  "reasonCode": "device_mismatch",
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
    "mode": "blocked",
    "reason": "Current device does not match the bound machine."
  }
}
```

Clone-suspected example:

```json
{
  "valid": false,
  "status": "degraded",
  "licenseStatus": "degraded",
  "activationId": "act_01HXYZ123",
  "activationToken": null,
  "validatedAt": "2026-03-27T12:05:00.000Z",
  "graceUntil": null,
  "reasonCode": "clone_suspected",
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
    "mode": "blocked",
    "reason": "Potential cloned installation detected."
  }
}
```

## POST /heartbeat

Reports continued use by an activated installation.

Example request:

```json
{
  "key": "LIC-123-ABC-999",
  "activationId": "act_01HXYZ123",
  "lastHeartbeatAt": "2026-03-27T11:30:00.000Z",
  "device": {
    "machineId": "e0f0d8d4f7c3d0f5a0a1b2c3d4e5f67890abcdef1234567890abcdef12345678",
    "installationId": "8b8e52a4-4dc5-4f44-8c95-7d5ef8d4c120",
    "fingerprintVersion": "machine-v1",
    "appId": "default-electron-app",
    "appVersion": "2.2.0"
  }
}
```

Successful response example:

```json
{
  "ok": true,
  "status": "active",
  "licenseStatus": "active",
  "activationId": "act_01HXYZ123",
  "activationToken": "tok_live_01HXYZ123",
  "heartbeatAt": "2026-03-27T12:10:00.000Z",
  "graceUntil": null,
  "reasonCode": "none",
  "gracePeriod": {
    "active": false,
    "startedAt": null,
    "endsAt": null,
    "remainingDays": 7
  },
  "entitlements": {
    "items": []
  },
  "degradedMode": {
    "active": false,
    "mode": "none",
    "reason": null
  }
}
```

Suspicious heartbeat example:

```json
{
  "ok": false,
  "status": "degraded",
  "licenseStatus": "degraded",
  "activationId": "act_01HXYZ123",
  "activationToken": null,
  "heartbeatAt": "2026-03-27T12:10:00.000Z",
  "graceUntil": null,
  "reasonCode": "clone_suspected",
  "gracePeriod": {
    "active": false,
    "startedAt": null,
    "endsAt": null,
    "remainingDays": 0
  },
  "entitlements": {
    "items": []
  },
  "degradedMode": {
    "active": true,
    "mode": "blocked",
    "reason": "Potential cloned installation detected."
  }
}
```

## Response Status Expectations

High-level license states:

- `active`
- `degraded`
- `expired`
- `invalid`
- `revoked`
- `unlicensed`

Important anti-clone reason codes:

- `device_mismatch`
- `clone_suspected`
- `reauthorization_required`
- `device_limit_exceeded`

The backend should use `reasonCode` for machine-binding decisions. The desktop client should not rely on HTTP status codes alone for business logic.

## Non-Destructive Anti-Clone Rule

This is the critical rule for the backend:

- A suspicious validation or heartbeat from a copied install must not silently transfer the license to the new machine.
- A suspicious validation or heartbeat must not invalidate the legitimate original binding as a side effect.
- The backend should return a decision for the requesting device, not mutate ownership automatically.

Practical meaning:

- If a copied install appears on another machine, return `device_mismatch` or `clone_suspected`.
- Do not auto-rotate `activationId` or `activationToken` to the new machine.
- Do not overwrite the original machine binding unless an explicit rebind flow is completed.

## Explicit Rebind Rule

Legitimate migration to a new computer must be explicit.

Expected backend behavior:

- Do not treat mismatch as implicit authorization to move the license.
- Require a deliberate reauthorization or rebind operation.
- Only after explicit confirmation should the backend create or replace the binding for the new machine.

Suggested rebind behavior:

1. Existing machine reports `device_mismatch` or `reauthorization_required`.
2. User performs an explicit reauthorization flow.
3. Backend confirms the new device is allowed to take over the license.
4. Backend returns a new active activation binding for the new machine.

## Device Limit Handling

If a license has a device count limit, the backend should enforce it without ambiguity.

Recommended behavior:

- Return `device_limit_exceeded` when activation or rebind is not allowed because the license has no remaining device slots.
- Do not silently evict an existing device unless the product explicitly supports managed device replacement.
- If managed replacement exists, it should still require an explicit user-driven action, not an automatic mismatch-based takeover.

## Suggested HTTP Semantics

Suggested status code mapping:

- `200` for successful activation, validation, heartbeat, and controlled degraded responses
- `400` or `422` for malformed request or invalid license input
- `402` for expired license
- `403` for revoked license or denied protected operation
- `409` for device mismatch, clone suspicion, or explicit rebind conflicts
- `429` for device limit exceeded when rate/seat/device enforcement semantics fit
- `503` for temporary backend unavailability

The client should still evaluate payload fields such as `status`, `licenseStatus`, `reasonCode`, `graceUntil`, and `degradedMode`.
