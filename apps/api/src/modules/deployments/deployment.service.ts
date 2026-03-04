import { DeploymentRepository } from './deployment.repository.js';
import { DomainRepository } from '../domains/domain.repository.js';
import { ServerRepository } from '../servers/server.repository.js';
import { AgentService } from '../../services/agent.service.js';
import { NotFoundError, AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import type { CreateDeploymentInput } from '@cubiqport/shared';

const deployRepo = new DeploymentRepository();
const domainRepo = new DomainRepository();
const serverRepo = new ServerRepository();
const agentService = new AgentService();

export class DeploymentService {
  async listDeployments(domainId: string, userId: string) {
    const domain = await domainRepo.findById(domainId, userId);
    if (!domain) throw new NotFoundError('Domain');
    return deployRepo.findByDomainId(domainId);
  }

  async getDeployment(id: string) {
    const deployment = await deployRepo.findById(id);
    if (!deployment) throw new NotFoundError('Deployment');
    return deployment;
  }

  async createDeployment(userId: string, input: CreateDeploymentInput) {
    const domain = await domainRepo.findById(input.domainId, userId);
    if (!domain) throw new NotFoundError('Domain');
    if (domain.status !== 'active') {
      throw new AppError('Domain must be active before deploying', 400);
    }

    const server = await serverRepo.findByIdUnscoped(domain.serverId);
    if (!server) throw new NotFoundError('Server');

    const deployment = await deployRepo.create({
      domainId: input.domainId,
      repository: input.repository,
      branch: input.branch,
      buildCommand: input.buildCommand,
      startCommand: input.startCommand,
      envVars: input.envVars,
      status: 'pending',
    });

    // Kick off deploy asynchronously
    this.runDeploy(deployment.id, server.ip, {
      domainId: input.domainId,
      repository: input.repository,
      branch: input.branch,
      buildCommand: input.buildCommand,
      startCommand: input.startCommand,
      rootPath: domain.rootPath,
      port: domain.port,
      envVars: input.envVars,
    }).catch((err) =>
      logger.error({ err, deploymentId: deployment.id }, 'Deployment run failed'),
    );

    return deployment;
  }

  async cancelDeployment(id: string, userId: string) {
    const deployment = await deployRepo.findById(id);
    if (!deployment) throw new NotFoundError('Deployment');

    const domain = await domainRepo.findById(deployment.domainId, userId);
    if (!domain) throw new NotFoundError('Domain');

    if (deployment.status !== 'running' && deployment.status !== 'pending') {
      throw new AppError('Only running or pending deployments can be cancelled', 400);
    }
    await deployRepo.updateStatus(id, 'cancelled');
    return { cancelled: true };
  }

  private async runDeploy(
    deploymentId: string,
    serverIp: string,
    payload: Parameters<AgentService['deploy']>[1],
  ) {
    await deployRepo.updateStatus(deploymentId, 'running');
    try {
      const result = await agentService.deploy(serverIp, payload);
      await deployRepo.updateStatus(
        deploymentId,
        'success',
        `Deployment dispatched. Agent job: ${result.jobId}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await deployRepo.updateStatus(deploymentId, 'failed', msg);
      throw err;
    }
  }
}
