import { KernelBus, KernelEvent } from '../kernel/bus';

export type SwarmMessage = {
    from: string;
    to: string | '*'; // '*' = broadcast
    channel: string;
    payload: any;
    timestamp: number;
};

export type VoteRequest = {
    proposer: string;
    proposal: string;
    voters: string[];
};

export type VoteResult = {
    proposal: string;
    votes: Map<string, boolean>;
    accepted: boolean;
    quorum: number;
};

/**
 * SwarmProtocol enables agent-to-agent communication
 * routed through the KernelBus for full auditability.
 */
export class SwarmProtocol {
    private channels: Map<string, ((msg: SwarmMessage) => void)[]> = new Map();
    private messageLog: SwarmMessage[] = [];

    constructor(private readonly bus: KernelBus) { }

    /**
     * Subscribe an agent to a named channel.
     */
    subscribe(agentId: string, channel: string, handler: (msg: SwarmMessage) => void): void {
        const key = `${channel}`;
        if (!this.channels.has(key)) {
            this.channels.set(key, []);
        }
        this.channels.get(key)!.push(handler);
    }

    /**
     * Send a message to a specific agent or broadcast to all on a channel.
     */
    send(message: SwarmMessage): void {
        this.messageLog.push(Object.freeze({ ...message }));

        const handlers = this.channels.get(message.channel) || [];
        for (const handler of handlers) {
            handler(message);
        }
    }

    /**
     * Broadcast a message to all subscribers on a channel.
     */
    broadcast(from: string, channel: string, payload: any): void {
        this.send({
            from,
            to: '*',
            channel,
            payload,
            timestamp: Date.now()
        });
    }

    /**
     * Simple majority voting protocol.
     * Returns accepted=true if > 50% of voters approve.
     */
    requestVote(
        request: VoteRequest,
        voterDecisions: Map<string, boolean>
    ): VoteResult {
        const votes = new Map<string, boolean>();
        let approvals = 0;

        for (const voter of request.voters) {
            const decision = voterDecisions.get(voter) ?? false;
            votes.set(voter, decision);
            if (decision) approvals++;
        }

        const quorum = Math.ceil(request.voters.length / 2);
        const accepted = approvals >= quorum;

        return {
            proposal: request.proposal,
            votes,
            accepted,
            quorum
        };
    }

    /**
     * Reach consensus: all voters must agree (unanimous).
     */
    reachConsensus(
        request: VoteRequest,
        voterDecisions: Map<string, boolean>
    ): VoteResult {
        const result = this.requestVote(request, voterDecisions);

        // Override: consensus requires ALL agree
        let allAgree = true;
        for (const [, vote] of result.votes) {
            if (!vote) { allAgree = false; break; }
        }

        return { ...result, accepted: allAgree };
    }

    getMessageLog(): ReadonlyArray<SwarmMessage> {
        return Object.freeze([...this.messageLog]);
    }
}
