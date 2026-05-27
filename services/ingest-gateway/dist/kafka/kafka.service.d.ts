import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
export declare class KafkaService implements OnModuleInit, OnModuleDestroy {
    private kafka;
    private producer;
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    publish(topic: string, messagePayloads: any[]): void;
    publishBatch(batches: {
        topic: string;
        messages: any[];
    }[]): void;
}
