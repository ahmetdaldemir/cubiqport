export interface NetworkUsage {
  rx: number;
  tx: number;
}

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: string[];
}

export interface LiveMetrics {
  cpuUsage: number;
  ramUsage: number;
  diskUsage: number;
  networkUsage: NetworkUsage;
  containers: ContainerInfo[];
  uptime: number;
  timestamp: string;
}
