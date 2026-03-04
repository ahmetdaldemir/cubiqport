import { execSync } from 'child_process';

export interface DeployParams {
  domainId: string;
  repository: string;
  branch: string;
  buildCommand?: string;
  startCommand?: string;
  rootPath: string;
  port: number;
  envVars?: Record<string, string>;
}

/**
 * Clones/pulls the repository, builds the Docker image, and starts the container.
 * Returns a job ID (the container name).
 */
export function deployApp(params: DeployParams): string {
  const containerName = `cubiq-${params.domainId.substring(0, 8)}`;
  const imageName = `${containerName}:latest`;
  const appDir = `${params.rootPath}/${params.domainId}`;

  const envFlags = params.envVars
    ? Object.entries(params.envVars)
        .map(([k, v]) => `-e ${k}=${JSON.stringify(v)}`)
        .join(' ')
    : '';

  const steps = [
    // Clone or update repo
    `mkdir -p ${appDir}`,
    `cd ${appDir} && (git pull 2>/dev/null || git clone --depth 1 --branch ${params.branch} ${params.repository} .)`,

    // Build
    params.buildCommand
      ? `cd ${appDir} && ${params.buildCommand}`
      : `cd ${appDir} && docker build -t ${imageName} .`,

    // Stop existing container if running
    `docker stop ${containerName} 2>/dev/null || true`,
    `docker rm ${containerName} 2>/dev/null || true`,

    // Start container
    params.startCommand
      ? `cd ${appDir} && docker run -d --name ${containerName} --restart unless-stopped -p 127.0.0.1:${params.port}:${params.port} ${envFlags} ${imageName} ${params.startCommand}`
      : `docker run -d --name ${containerName} --restart unless-stopped -p 127.0.0.1:${params.port}:${params.port} ${envFlags} ${imageName}`,
  ];

  for (const step of steps) {
    execSync(step, { stdio: 'pipe', timeout: 300_000 });
  }

  return containerName;
}

export function stopContainer(name: string): void {
  execSync(`docker stop ${name} 2>/dev/null || true`, { stdio: 'pipe' });
}

export function getContainerLogs(name: string, tail = 100): string {
  try {
    return execSync(`docker logs --tail ${tail} ${name}`, { encoding: 'utf8' });
  } catch {
    return '';
  }
}
