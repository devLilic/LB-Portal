import type {
  LicenseActivationRequest,
  LicenseActivationResult,
  LicenseEntitlementsRequest,
  LicenseEntitlementsResult,
  LicenseHeartbeatRequest,
  LicenseHeartbeatResult,
  LicenseStatusSnapshot,
  LicenseValidationRequest,
  LicenseValidationResult,
} from '../../../../src/shared/licensing/contracts'

export interface LicensingProvider {
  getStatus(): Promise<LicenseStatusSnapshot>
  activate(request: LicenseActivationRequest): Promise<LicenseActivationResult>
  validate(request: LicenseValidationRequest): Promise<LicenseValidationResult>
  heartbeat(request: LicenseHeartbeatRequest): Promise<LicenseHeartbeatResult>
  getEntitlements(request: LicenseEntitlementsRequest): Promise<LicenseEntitlementsResult>
}
