import { ChaincodeResponse, ChaincodeStub, Shim } from 'fabric-shim';
import { EmissionsRecordInterface } from './lib/emissions';
import { EmissionsFactorInterface } from './lib/emissionsFactor';
import { EmissionsRecordContract } from './lib/emissionsRecordContract';
import { DivisionsInterface, UtilityLookupItemInterface } from './lib/utilityLookupItem';
import {
    ErrInvalidArgument,
    ErrInvalidNumberOfArgument,
    ErrMethodNotSupported,
    MsgSuccess,
} from './util/const';
import { logger, stringToBytes } from './util/util';

class EmissionsChaincode {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private methods: {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        [key: string]: (stub: ChaincodeStub, args: string[]) => Promise<ChaincodeResponse>;
    } = {
        importUtilityIdentifier: this.importUtilityIdentifier,
        updateUtilityIdentifier: this.updateUtilityIdentifier,
        updateEmissionsMintedToken: this.updateEmissionsMintedToken,
        getUtilityIdentifier: this.getUtilityIdentifier,
        getAllUtilityIdentifiers: this.getAllUtilityIdentifiers,
        importUtilityFactor: this.importUtilityFactor,
        updateUtilityFactor: this.updateUtilityFactor,
        getUtilityFactor: this.getUtilityFactor,
        recordEmissions: this.recordEmissions,
        updateEmissionsRecord: this.updateEmissionsRecord,
        getEmissionsData: this.getEmissionsData,
        getAllEmissionsData: this.getAllEmissionsData,
        getAllEmissionsDataByDateRange: this.getAllEmissionsDataByDateRange,
        getAllEmissionsDataByDateRangeAndParty: this.getAllEmissionsDataByDateRangeAndParty,

        // for lockdata
        getValidEmissions: this.getValidEmissions,
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async Init(stub: ChaincodeStub): Promise<ChaincodeResponse> {
        return Shim.success(null);
    }
    async Invoke(stub: ChaincodeStub): Promise<ChaincodeResponse> {
        const { fcn, params } = stub.getFunctionAndParameters();
        const method = this.methods[fcn];
        if (!method) {
            logger.error(`${ErrMethodNotSupported} : ${fcn} is not supported`);
            return Shim.error(
                new TextEncoder().encode(`${ErrMethodNotSupported} : ${fcn} is not supported`),
            );
        }
        return await method(stub, params);
    }
    async recordEmissions(stub: ChaincodeStub, args: string[]): Promise<ChaincodeResponse> {
        logger.info(`recordEmissions method called with args : ${args}`);
        const fields = [
            'utilityId',
            'partyId',
            'fromDate',
            'thruDate',
            'energyUseAmount',
            'energyUseUom',
            'url',
            'md5',
        ];
        const fieldsMap = {
            utilityId: null,
            partyId: null,
            fromDate: null,
            thruDate: null,
            energyUseAmount: null,
            energyUseUom: null,
            url: null,
            md5: null,
        };
        const fieldsLen = Math.min(args.length, fields.length);
        for (let i = 0; i < fieldsLen; i++) {
            fieldsMap[fields[i]] = args[i];
        }
        let byte: Uint8Array;
        try {
            byte = await new EmissionsRecordContract(stub).recordEmissions(
                fieldsMap.utilityId,
                fieldsMap.partyId,
                fieldsMap.fromDate,
                fieldsMap.thruDate,
                fieldsMap.energyUseAmount,
                fieldsMap.energyUseUom,
                fieldsMap.url,
                fieldsMap.md5,
            );
        } catch (error) {
            console.log(error);
            return Shim.error(stringToBytes((error as Error).message));
        }
        logger.debug(`${MsgSuccess} recordEmissions success ${byte.toString()}`);
        return Shim.success(byte);
    }

    async updateEmissionsRecord(stub: ChaincodeStub, args: string[]): Promise<ChaincodeResponse> {
        const fields = [
            'uuid',
            'utilityId',
            'partyId',
            'fromDate',
            'thruDate',
            'emissionsAmount',
            'renewableEnergyUseAmount',
            'nonrenewableEnergyUseAmount',
            'energyUseUom',
            'factorSource',
            'url',
            'md5',
            'tokenId',
        ];
        const numberFields = [
            'emissionsAmount',
            'renewableEnergyUseAmount',
            'nonrenewableEnergyUseAmount',
        ];
        const recordI: EmissionsRecordInterface = {};
        const fieldsLen = Math.min(args.length, fields.length);
        for (let i = 0; i < fieldsLen; i++) {
            if (numberFields.indexOf(fields[i]) > -1) {
                recordI[fields[i]] = Number(args[i]);
            } else {
                recordI[fields[i]] = args[i];
            }
        }
        let byte: Uint8Array;
        try {
            byte = await new EmissionsRecordContract(stub).updateEmissionsRecord(recordI);
        } catch (error) {
            logger.error(error);
            return Shim.error(stringToBytes((error as Error).message));
        }
        return Shim.success(byte);
    }
    /**
     * @description will update emissions record(s) with minted token
     * @param args client input
     *      - args[0] : tokenId:string
     *      - args[1...] : uuids:Array<string>
     */
    async updateEmissionsMintedToken(
        stub: ChaincodeStub,
        args: string[],
    ): Promise<ChaincodeResponse> {
        logger.info(`updateEmissionsMintedToken method will args : ${args}`);
        if (args.length < 3) {
            logger.error(
                `${ErrInvalidArgument} : updateEmissionsMintedToken requires 3 or more args, but provided ${args.length}`,
            );
            return Shim.error(
                stringToBytes(
                    `${ErrInvalidArgument} : updateEmissionsMintedToken requires 3 or more args, but provided ${args.length}`,
                ),
            );
        }
        const tokenId = args[0];
        const partyId = args[1];
        const uuids = args.slice(2);
        try {
            const out = await new EmissionsRecordContract(stub).updateEmissionsMintedToken(
                tokenId,
                partyId,
                uuids,
            );
            return Shim.success(out);
        } catch (error) {
            logger.error(error);
            return Shim.error(stringToBytes((error as Error).message));
        }
    }
    async getEmissionsData(stub: ChaincodeStub, args: string[]): Promise<ChaincodeResponse> {
        logger.info(`getEmissionsData method called with args : ${args}`);
        if (args.length !== 1) {
            logger.error(
                `${ErrInvalidNumberOfArgument} : getEmissionsData requires 1 arg , but provided ${args.length}`,
            );
            return Shim.error(
                stringToBytes(
                    `${ErrInvalidNumberOfArgument} : getEmissionsData requires 1 arg , but provided ${args.length}`,
                ),
            );
        }
        let byte: Uint8Array;
        try {
            byte = await new EmissionsRecordContract(stub).getEmissionsData(args[0]);
        } catch (error) {
            logger.error(error);
            return Shim.error(stringToBytes((error as Error).message));
        }
        return Shim.success(byte);
    }

    async getValidEmissions(stub: ChaincodeStub, args: string[]): Promise<ChaincodeResponse> {
        logger.info(`getValidEmissions method called with args : ${args}`);
        let byte: Uint8Array;
        try {
            byte = await new EmissionsRecordContract(stub).getValidEmissions(args);
            return Shim.success(byte);
        } catch (error) {
            logger.error(error);
            return Shim.error(stringToBytes((error as Error).message));
        }
    }
    async getAllEmissionsData(stub: ChaincodeStub, args: string[]): Promise<ChaincodeResponse> {
        logger.info(`getAllEmissionsData method called with args : ${args}`);
        if (args.length !== 2) {
            logger.error(
                `${ErrInvalidNumberOfArgument} : getAllEmissionsData requires 2 arg , but provided ${args.length}`,
            );
            return Shim.error(
                stringToBytes(
                    `${ErrInvalidNumberOfArgument} : getAllEmissionsData requires 2 arg , but provided ${args.length}`,
                ),
            );
        }
        let byte: Uint8Array;
        try {
            byte = await new EmissionsRecordContract(stub).getAllEmissionsData(args[0], args[1]);
        } catch (error) {
            logger.error(error);
            return Shim.error(stringToBytes((error as Error).message));
        }
        return Shim.success(byte);
    }
    async getAllEmissionsDataByDateRange(
        stub: ChaincodeStub,
        args: string[],
    ): Promise<ChaincodeResponse> {
        logger.info(`getAllEmissionsDataByDateRange method called with args : ${args}`);
        if (args.length !== 2) {
            logger.error(
                `${ErrInvalidNumberOfArgument} : getAllEmissionsDataByDateRange requires 2 arg , but provided ${args.length}`,
            );
            return Shim.error(
                stringToBytes(
                    `${ErrInvalidNumberOfArgument} : getAllEmissionsDataByDateRange requires 2 arg , but provided ${args.length}`,
                ),
            );
        }
        let byte: Uint8Array;
        try {
            byte = await new EmissionsRecordContract(stub).getAllEmissionsDataByDateRange(
                args[0],
                args[1],
            );
        } catch (error) {
            logger.error(error);
            return Shim.error(stringToBytes((error as Error).message));
        }
        return Shim.success(byte);
    }
    async getAllEmissionsDataByDateRangeAndParty(
        stub: ChaincodeStub,
        args: string[],
    ): Promise<ChaincodeResponse> {
        logger.info(`getAllEmissionsDataByDateRangeAndParty method called with args : ${args}`);
        if (args.length !== 3) {
            logger.error(
                `${ErrInvalidNumberOfArgument} : getAllEmissionsDataByDateRangeAndParty requires 3 arg , but provided ${args.length}`,
            );
            return Shim.error(
                stringToBytes(
                    `${ErrInvalidNumberOfArgument} : getAllEmissionsDataByDateRangeAndParty requires 3 arg , but provided ${args.length}`,
                ),
            );
        }
        let byte: Uint8Array;
        try {
            byte = await new EmissionsRecordContract(stub).getAllEmissionsDataByDateRangeAndParty(
                args[0],
                args[1],
                args[2],
            );
        } catch (error) {
            logger.error(error);
            return Shim.error(stringToBytes((error as Error).message));
        }
        return Shim.success(byte);
    }
    /**
     * @param args : ['uuid', 'year', 'country',
     * 'division_type','division_id','division_name','net_generation',
     * 'net_generation_uom','co2_equivalent_emissions','co2_equivalent_emissions_uom',
     * 'source','non_renewables','renewables','percent_of_renewables']
     */
    async importUtilityFactor(stub: ChaincodeStub, args: string[]): Promise<ChaincodeResponse> {
        logger.info(`importUtilityFactor method called with args : ${args}`);
        // uuid is required for importing utility factor
        if (args.length < 1) {
            logger.error(
                `${ErrInvalidNumberOfArgument} : importUtilityFactor method requires at-least 1 argument, but got ${args.length}`,
            );
            return Shim.error(
                stringToBytes(
                    `${ErrInvalidNumberOfArgument} : importUtilityFactor method requires at-least 1 argument, but got ${args.length}`,
                ),
            );
        }

        // order of args input
        const fields = [
            'uuid',
            'year',
            'country',
            'division_type',
            'division_id',
            'division_name',
            'net_generation',
            'net_generation_uom',
            'co2_equivalent_emissions',
            'co2_equivalent_emissions_uom',
            'source',
            'non_renewables',
            'renewables',
            'percent_of_renewables',
        ];
        const min = Math.min(fields.length, args.length);
        const factorI = {
            uuid: args[0],
        } as EmissionsFactorInterface;
        for (let i = 1; i < min; i++) {
            factorI[fields[i]] = args[i];
        }
        let byte: Uint8Array;
        try {
            byte = await new EmissionsRecordContract(stub).importUtilityFactor(factorI);
        } catch (error) {
            logger.error(error);
            return Shim.error(stringToBytes((error as Error).message));
        }
        logger.debug(`${MsgSuccess} importUtilityFactor success ${byte.toString()}`);
        return Shim.success(byte);
    }
    /**
     * @param args : ['uuid', 'year', 'country',
     * 'division_type','division_id','division_name','net_generation',
     * 'net_generation_uom','co2_equivalent_emissions','co2_equivalent_emissions_uom',
     * 'source','non_renewables','renewables','percent_of_renewables']
     */
    async updateUtilityFactor(stub: ChaincodeStub, args: string[]): Promise<ChaincodeResponse> {
        logger.info(`updateUtilityFactor method called with args : ${args}`);
        // uuid is required for importing utility factor
        if (args.length < 1) {
            logger.error(
                `${ErrInvalidNumberOfArgument} : updateUtilityFactor method requires at-least 1 argument, but got ${args.length}`,
            );
            return Shim.error(
                stringToBytes(
                    `${ErrInvalidNumberOfArgument} : updateUtilityFactor method requires at-least 1 argument, but got ${args.length}`,
                ),
            );
        }

        // order of args input
        const fields = [
            'uuid',
            'year',
            'country',
            'division_type',
            'division_id',
            'division_name',
            'net_generation',
            'net_generation_uom',
            'co2_equivalent_emissions',
            'co2_equivalent_emissions_uom',
            'source',
            'non_renewables',
            'renewables',
            'percent_of_renewables',
        ];
        const min = Math.min(fields.length, args.length);
        const factorI = {
            uuid: args[0],
        } as EmissionsFactorInterface;
        for (let i = 1; i < min; i++) {
            factorI[fields[i]] = args[i];
        }
        let byte: Uint8Array;
        try {
            byte = await new EmissionsRecordContract(stub).updateUtilityFactor(factorI);
        } catch (error) {
            logger.error(error);
            return Shim.error(stringToBytes((error as Error).message));
        }
        logger.debug(`${MsgSuccess} updateUtilityFactor success ${byte.toString()}`);
        return Shim.success(byte);
    }

    /**
     * @param args : ['uuid']
     */
    async getUtilityFactor(stub: ChaincodeStub, args: string[]): Promise<ChaincodeResponse> {
        logger.info(`getUtilityFactor method called with args : ${args}`);
        if (args.length !== 1) {
            logger.error(
                `${ErrInvalidNumberOfArgument} : getUtilityFactor requires 1 arg , but provided ${args.length}`,
            );
            return Shim.error(
                stringToBytes(
                    `${ErrInvalidNumberOfArgument} : getUtilityFactor requires 1 arg , but provided ${args.length}`,
                ),
            );
        }
        let byte: Uint8Array;
        try {
            byte = await new EmissionsRecordContract(stub).getUtilityFactor(args[0]);
        } catch (error) {
            logger.error(error);
            return Shim.error(stringToBytes((error as Error).message));
        }
        return Shim.success(byte);
    }
    /**
     * @param args : ['uuid', 'year', 'utility_number', 'utility_name', 'country', 'state_province', '{"division_type" : "","division_id" : ""}']
     */
    async importUtilityIdentifier(stub: ChaincodeStub, args: string[]): Promise<ChaincodeResponse> {
        logger.info(`importUtilityIdentifier method called with args : ${args}`);
        // uuid is required for importing utility identifer
        if (args.length < 1) {
            logger.error(
                `${ErrInvalidNumberOfArgument} : importUtilityIdentifier method requires at-least 1 argument, but got ${args.length}`,
            );
            return Shim.error(
                stringToBytes(
                    `${ErrInvalidNumberOfArgument} : importUtilityIdentifier method requires at-least 1 argument, but got ${args.length}`,
                ),
            );
        }
        const fields = [
            'uuid',
            'year',
            'utility_number',
            'utility_name',
            'country',
            'state_province',
            'divisions',
        ];
        const min = Math.min(args.length, fields.length);
        const identifier = { uuid: args[0] } as UtilityLookupItemInterface;
        for (let i = 1; i < min; i++) {
            identifier[fields[i]] = args[i];
        }
        // division exists
        if (args.length === 7) {
            delete identifier.divisions;
            let division: DivisionsInterface;
            try {
                division = JSON.parse(args[6]) as DivisionsInterface;
            } catch (error) {
                logger.error(`${ErrInvalidArgument} : invalid divsion json input ${error}`);
                return Shim.error(stringToBytes((error as Error).message));
            }
            identifier.divisions = division;
        }
        let byte: Uint8Array;
        try {
            byte = await new EmissionsRecordContract(stub).importUtilityIdentifier(identifier);
        } catch (error) {
            logger.error(error);
            return Shim.error(stringToBytes((error as Error).message));
        }
        logger.debug(`${MsgSuccess} importUtilityIdentifier success ${byte.toString()}`);
        return Shim.success(byte);
    }
    /**
     * @param args : ['uuid', 'year', 'utility_number', 'utility_name', 'country', 'state_province', '{"division_type" : "","division_id" : ""}']
     */
    async updateUtilityIdentifier(stub: ChaincodeStub, args: string[]): Promise<ChaincodeResponse> {
        logger.info(`updateUtilityIdentifier method called with args : ${args}`);
        // uuid is required for importing utility identifer
        if (args.length < 1) {
            logger.error(
                `${ErrInvalidNumberOfArgument} : updateUtilityIdentifier method requires at-least 1 argument, but got ${args.length}`,
            );
            return Shim.error(
                stringToBytes(
                    `${ErrInvalidNumberOfArgument} : updateUtilityIdentifier method requires at-least 1 argument, but got ${args.length}`,
                ),
            );
        }
        const fields = [
            'uuid',
            'year',
            'utility_number',
            'utility_name',
            'country',
            'state_province',
            'divisions',
        ];
        const min = Math.min(args.length, fields.length);
        const identifier = { uuid: args[0] } as UtilityLookupItemInterface;
        for (let i = 1; i < min; i++) {
            identifier[fields[i]] = args[i];
        }
        // division exists
        if (args.length === 7) {
            delete identifier.divisions;
            const divisionJSON = JSON.parse(args[6]);
            let division: DivisionsInterface;
            if (divisionJSON.division_type && divisionJSON.division_id) {
                division = {
                    division_id: divisionJSON.division_id,
                    division_type: divisionJSON.division_type,
                };
            } else {
                logger.error(`${ErrInvalidArgument} : invalid division , got : ${args[6]}`);
                return Shim.error(
                    stringToBytes(
                        `${ErrInvalidArgument} : division should represented by : '{"division_type" : "","division_id" : ""}`,
                    ),
                );
            }
            identifier.divisions = division;
        }
        let byte: Uint8Array;
        try {
            byte = await new EmissionsRecordContract(stub).updateUtilityIdentifier(identifier);
        } catch (error) {
            logger.error(error);
            return Shim.error(stringToBytes((error as Error).message));
        }
        logger.debug(`${MsgSuccess} updateUtilityIdentifier success ${byte.toString()}`);
        return Shim.success(byte);
    }

    /**
     * @param args : ['uuid']
     */
    async getUtilityIdentifier(stub: ChaincodeStub, args: string[]): Promise<ChaincodeResponse> {
        logger.info(`getUtilityIdentifier method called with args : ${args}`);
        if (args.length !== 1) {
            logger.error(
                `${ErrInvalidNumberOfArgument} : getUtilityIdentifier requires 1 arg , but provided ${args.length}`,
            );
            return Shim.error(
                stringToBytes(
                    `${ErrInvalidNumberOfArgument} : getUtilityIdentifier requires 1 arg , but provided ${args.length}`,
                ),
            );
        }
        let byte: Uint8Array;
        try {
            byte = await new EmissionsRecordContract(stub).getUtilityIdentifier(args[0]);
        } catch (error) {
            logger.error(error);
            return Shim.error(stringToBytes((error as Error).message));
        }
        logger.debug(`${MsgSuccess} getUtilityIdentifier success ${byte.toString()}`);
        return Shim.success(byte);
    }

    async getAllUtilityIdentifiers(
        stub: ChaincodeStub,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        args: string[],
    ): Promise<ChaincodeResponse> {
        let byte: Uint8Array;
        try {
            byte = await new EmissionsRecordContract(stub).getAllUtilityIdentifiers();
        } catch (error) {
            logger.error(error);
            return Shim.error(stringToBytes((error as Error).message));
        }
        return Shim.success(byte);
    }
}

Shim.start(new EmissionsChaincode());
