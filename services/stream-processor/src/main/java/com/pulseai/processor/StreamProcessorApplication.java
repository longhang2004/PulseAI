package com.pulseai.processor;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class StreamProcessorApplication {

    public static void main(String[] args) {
        SpringApplication.run(StreamProcessorApplication.class, args);
        System.out.println("PulseAI Stream Processor is running on: http://localhost:8080");
    }
}
