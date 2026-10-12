import type {
  InstallationId,
} from '../../../../../src/shared/licensing/device-identity'

export interface InstallationIdentityProvider {
  getInstallationId: () => InstallationId
}
