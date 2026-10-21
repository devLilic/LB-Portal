import type { MainModule } from '../../../src/shared/modules/contracts'
import { registerOnAirCsvModule } from './registerOnAirCsvModule'

export function createOnAirCsvMainModule(): MainModule {
  return {
    id: 'onair-csv',
    register(context) {
      registerOnAirCsvModule(context)
    },
  }
}
