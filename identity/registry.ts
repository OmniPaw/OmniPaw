import { AgentId, AgentIdentity } from './types';

export class AgentRegistry {
    private identities: Map<AgentId, AgentIdentity> = new Map();

    registerAgent(identity: AgentIdentity): void {
        if (this.identities.has(identity.id)) {
            throw new Error(`Agent with id ${identity.id} already registered`);
        }

        // Freeze identity before storing to ensure immutability
        Object.freeze(identity);
        this.identities.set(identity.id, identity);
    }

    getAgent(agentId: AgentId): AgentIdentity | undefined {
        return this.identities.get(agentId);
    }

    listAgents(): AgentIdentity[] {
        return Array.from(this.identities.values());
    }
}
