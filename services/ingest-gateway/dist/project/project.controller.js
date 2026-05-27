"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const project_entity_1 = require("../entities/project.entity");
const api_key_entity_1 = require("../entities/api-key.entity");
const crypto = require("crypto");
let ProjectController = class ProjectController {
    constructor(projectRepository, apiKeyRepository) {
        this.projectRepository = projectRepository;
        this.apiKeyRepository = apiKeyRepository;
    }
    async createProject(name) {
        if (!name || typeof name !== 'string') {
            return { success: false, error: 'Project name is required' };
        }
        const project = this.projectRepository.create({ name });
        const savedProject = await this.projectRepository.save(project);
        return {
            success: true,
            data: savedProject,
        };
    }
    async generateKey(projectId) {
        const project = await this.projectRepository.findOne({ where: { id: projectId } });
        if (!project) {
            throw new common_1.NotFoundException('Project not found');
        }
        const randomBytes = crypto.randomBytes(24).toString('hex');
        const apiKeyString = `pa_${randomBytes}`;
        const apiKey = this.apiKeyRepository.create({
            key: apiKeyString,
            projectId: project.id,
            isActive: true,
        });
        const savedKey = await this.apiKeyRepository.save(apiKey);
        return {
            success: true,
            data: {
                id: savedKey.id,
                key: savedKey.key,
                projectId: savedKey.projectId,
                isActive: savedKey.isActive,
                createdAt: savedKey.createdAt,
            },
        };
    }
    async getProject(id) {
        const project = await this.projectRepository.findOne({ where: { id } });
        if (!project) {
            throw new common_1.NotFoundException('Project not found');
        }
        return { success: true, data: project };
    }
};
exports.ProjectController = ProjectController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)('name')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "createProject", null);
__decorate([
    (0, common_1.Post)(':id/keys'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "generateKey", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "getProject", null);
exports.ProjectController = ProjectController = __decorate([
    (0, common_1.Controller)('projects'),
    __param(0, (0, typeorm_1.InjectRepository)(project_entity_1.Project)),
    __param(1, (0, typeorm_1.InjectRepository)(api_key_entity_1.ApiKey)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], ProjectController);
//# sourceMappingURL=project.controller.js.map