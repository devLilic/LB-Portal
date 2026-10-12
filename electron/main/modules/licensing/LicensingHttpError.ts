import type { LicensingFailureReason } from '../../../../src/shared/licensing/policy'

export class LicensingHttpError extends Error {
  constructor(
    public readonly reason: LicensingFailureReason,
    message: string,
  ) {
    super(message)
    this.name = 'LicensingHttpError'
  }
}
