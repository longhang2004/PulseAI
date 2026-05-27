import { Repository } from 'typeorm';
import { Project } from '../entities/project.entity';
import { ApiKey } from '../entities/api-key.entity';
export declare class ProjectController {
    private readonly projectRepository;
    private readonly apiKeyRepository;
    constructor(projectRepository: Repository<Project>, apiKeyRepository: Repository<ApiKey>);
    createProject(name: string): Promise<{
        success: boolean;
        error: string;
        data?: undefined;
    } | {
        success: boolean;
        data: Project;
        error?: undefined;
    }>;
    generateKey(projectId: string): Promise<{
        success: boolean;
        data: {
            id: string;
            key: string;
            projectId: string;
            isActive: boolean;
            createdAt: Date;
        };
    }>;
    getProject(id: string): Promise<{
        success: boolean;
        data: Project;
    }>;
}
