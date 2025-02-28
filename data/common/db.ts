import { EmissionsFactorInterface } from "emissions_data_chaincode/src/lib/emissionsFactor"
import { UtilityLookupItemInterface } from "emissions_data_chaincode/src/lib/utilityLookupItem"

export interface EmissionFactorDbInterface {
  putEmissionFactor: (doc: EmissionsFactorInterface) => Promise<void>
  getEmissionFactor: (uuid: string) => Promise<EmissionsFactorInterface | null>
}

export interface UtilityLookupItemDbInterface {
  putUtilityLookupItem: (doc: UtilityLookupItemInterface) => Promise<void>
}

