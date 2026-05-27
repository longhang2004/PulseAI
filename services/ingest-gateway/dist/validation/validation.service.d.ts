export declare class ValidationService {
    private ajv;
    private logValidator;
    private metricValidator;
    private traceValidator;
    constructor();
    private initSchemas;
    validateSignal(signal: any): {
        valid: boolean;
        reason?: string;
    };
}
