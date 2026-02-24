export interface ResourceQuota {
    maxTicks: number;
    maxToolCalls: number;
}

export interface ResourceConsumption {
    ticks: number;
    toolCalls: number;
}

export class QuotaExceededError extends Error {
    constructor(
        public readonly resource: keyof ResourceConsumption,
        public readonly limit: number,
        public readonly agentId: string
    ) {
        super(`Agent ${agentId} exceeded quota for resource: ${resource} (limit: ${limit})`);
        this.name = 'QuotaExceededError';
    }
}

export class QuotaEnforcer {
    private limits = new Map<string, ResourceQuota>();
    private usage = new Map<string, ResourceConsumption>();

    public setQuota(agentId: string, quota: ResourceQuota): void {
        this.limits.set(agentId, quota);
        if (!this.usage.has(agentId)) {
            this.usage.set(agentId, { ticks: 0, toolCalls: 0 });
        }
    }

    public getQuota(agentId: string): ResourceQuota | undefined {
        return this.limits.get(agentId);
    }

    public getUsage(agentId: string): ResourceConsumption {
        return this.usage.get(agentId) || { ticks: 0, toolCalls: 0 };
    }

    public consumeTick(agentId: string): void {
        const quota = this.limits.get(agentId);
        const current = this.getUsage(agentId);

        current.ticks++;
        this.usage.set(agentId, current);

        if (quota && current.ticks > quota.maxTicks) {
            throw new QuotaExceededError('ticks', quota.maxTicks, agentId);
        }
    }

    public consumeToolCall(agentId: string): void {
        const quota = this.limits.get(agentId);
        const current = this.getUsage(agentId);

        current.toolCalls++;
        this.usage.set(agentId, current);

        if (quota && current.toolCalls > quota.maxToolCalls) {
            throw new QuotaExceededError('toolCalls', quota.maxToolCalls, agentId);
        }
    }
}
