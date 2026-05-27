import { ValidationService } from '../validation/validation.service';
import { KafkaService } from '../kafka/kafka.service';
import { StreamTrackerService } from './stream-tracker.service';
export declare class IngestController {
    private readonly validationService;
    private readonly kafkaService;
    private readonly streamTrackerService;
    constructor(validationService: ValidationService, kafkaService: KafkaService, streamTrackerService: StreamTrackerService);
    ingestBatch(body: {
        signals?: any[];
    }, req: any): Promise<{
        accepted: number;
        rejected: number;
        errors: {
            index: number;
            reason: string;
        }[];
    }>;
    ingestSingleLog(logBody: any, req: any): Promise<{
        accepted: number;
        rejected: number;
        errors: {
            index: number;
            reason: string;
        }[];
    }>;
    ingestSingleMetric(metricBody: any, req: any): Promise<{
        accepted: number;
        rejected: number;
        errors: {
            index: number;
            reason: string;
        }[];
    }>;
    ingestSingleTrace(traceBody: any, req: any): Promise<{
        accepted: number;
        rejected: number;
        errors: {
            index: number;
            reason: string;
        }[];
    }>;
    sdkHeartbeat(body: {
        streamId: string;
        sdkVersion: string;
        language: string;
    }, req: any): Promise<{
        success: boolean;
        error: string;
    } | {
        success: boolean;
        error?: undefined;
    }>;
}
