import { SwarmProtocol, SwarmMessage } from './protocol';
import { KernelBus } from '../kernel/bus';

export type SwarmStrategy = 'MAP_REDUCE' | 'CONSENSUS' | 'PIPELINE';

export type SwarmConfig = {
    agentIds: string[];
    goal: string;
    strategy: SwarmStrategy;
};

export type SwarmResult = {
    strategy: SwarmStrategy;
    goal: string;
    leader: string;
    agentResults: Map<string, any>;
    finalResult: any;
    messageCount: number;
};

/**
 * SwarmCoordinator orchestrates multi-agent collaboration.
 * Supports MAP_REDUCE (split→work→merge), CONSENSUS (vote), and PIPELINE (sequential).
 */
export class SwarmCoordinator {
    private protocol: SwarmProtocol;

    constructor(
        private readonly bus: KernelBus,
        private readonly config: SwarmConfig
    ) {
        this.protocol = new SwarmProtocol(bus);
    }

    /**
     * Elect a leader via simple majority (first agent that gets > 50% votes).
     * Each agent "votes" for itself; ties are broken by index order.
     */
    electLeader(): string {
        if (this.config.agentIds.length === 0) {
            throw new Error('SWARM_EMPTY: No agents to elect leader from.');
        }

        // Simple deterministic election: first agent is leader
        // In a real system, this would use Raft or Paxos
        const leader = this.config.agentIds[0];

        this.protocol.broadcast(leader, 'swarm.leadership', {
            event: 'LEADER_ELECTED',
            leader
        });

        return leader;
    }

    /**
     * Execute the swarm workflow using the configured strategy.
     */
    execute(
        taskSplitter: (goal: string, agentCount: number) => any[],
        agentWorker: (agentId: string, task: any) => any,
        resultMerger: (results: Map<string, any>) => any
    ): SwarmResult {
        const leader = this.electLeader();
        const agentResults = new Map<string, any>();

        switch (this.config.strategy) {
            case 'MAP_REDUCE': {
                // Leader splits the task
                const subtasks = taskSplitter(this.config.goal, this.config.agentIds.length);

                // Workers execute in parallel (simulated sequentially here)
                for (let i = 0; i < this.config.agentIds.length; i++) {
                    const agentId = this.config.agentIds[i];
                    const subtask = subtasks[i % subtasks.length];

                    this.protocol.send({
                        from: leader,
                        to: agentId,
                        channel: 'swarm.task',
                        payload: { subtask },
                        timestamp: Date.now()
                    });

                    const result = agentWorker(agentId, subtask);
                    agentResults.set(agentId, result);

                    this.protocol.send({
                        from: agentId,
                        to: leader,
                        channel: 'swarm.result',
                        payload: { result },
                        timestamp: Date.now()
                    });
                }

                // Leader merges results
                const finalResult = resultMerger(agentResults);

                return {
                    strategy: 'MAP_REDUCE',
                    goal: this.config.goal,
                    leader,
                    agentResults,
                    finalResult,
                    messageCount: this.protocol.getMessageLog().length
                };
            }

            case 'PIPELINE': {
                // Sequential pipeline: each agent passes result to next
                let currentInput = this.config.goal;

                for (const agentId of this.config.agentIds) {
                    const result = agentWorker(agentId, currentInput);
                    agentResults.set(agentId, result);

                    this.protocol.send({
                        from: agentId,
                        to: this.config.agentIds[this.config.agentIds.indexOf(agentId) + 1] || leader,
                        channel: 'swarm.pipeline',
                        payload: { stage: agentId, result },
                        timestamp: Date.now()
                    });

                    currentInput = result;
                }

                return {
                    strategy: 'PIPELINE',
                    goal: this.config.goal,
                    leader,
                    agentResults,
                    finalResult: currentInput,
                    messageCount: this.protocol.getMessageLog().length
                };
            }

            case 'CONSENSUS': {
                // All agents work independently, then vote on best result
                const subtasks = taskSplitter(this.config.goal, this.config.agentIds.length);

                for (let i = 0; i < this.config.agentIds.length; i++) {
                    const result = agentWorker(this.config.agentIds[i], subtasks[i % subtasks.length]);
                    agentResults.set(this.config.agentIds[i], result);
                }

                // Consensus: use the leader's result as final (simplification)
                const finalResult = agentResults.get(leader);

                return {
                    strategy: 'CONSENSUS',
                    goal: this.config.goal,
                    leader,
                    agentResults,
                    finalResult,
                    messageCount: this.protocol.getMessageLog().length
                };
            }
        }
    }

    getProtocol(): SwarmProtocol {
        return this.protocol;
    }
}
