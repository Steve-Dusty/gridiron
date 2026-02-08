export interface VeoJob {
  id: string;
  status: "pending" | "generating" | "complete" | "failed";
  videoPath?: string;
  error?: string;
}

const globalVeo = globalThis as typeof globalThis & {
  __gridion_veo?: Map<string, VeoJob>;
};

if (!globalVeo.__gridion_veo) {
  globalVeo.__gridion_veo = new Map<string, VeoJob>();
}

const jobs = globalVeo.__gridion_veo;

export function getVeoJob(id: string): VeoJob | undefined {
  return jobs.get(id);
}

export function setVeoJob(id: string, job: VeoJob): void {
  jobs.set(id, job);
}
