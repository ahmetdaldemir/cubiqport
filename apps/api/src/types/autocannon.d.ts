declare module 'autocannon' {
  interface AutocannonResult {
    requests: { total: number; average: number; [key: string]: unknown };
    latency: { mean?: number; average?: number; max?: number; [key: string]: unknown };
    errors: number;
    throughput?: { [key: string]: unknown };
  }
  interface AutocannonFn {
    (
      opts: { url: string; connections?: number; duration?: number; timeout?: number; method?: string; headers?: Record<string, string> },
      cb: (err: Error | null, result: AutocannonResult) => void,
    ): unknown;
    track(instance: unknown, opts?: { renderProgressBar?: boolean }): void;
  }
  const autocannon: AutocannonFn;
  export default autocannon;
}
