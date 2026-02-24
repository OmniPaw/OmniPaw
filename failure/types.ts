import { AgentId } from '../identity/types';

export type SerializableContext = Record<string, any>;

export type FailureClass =
    | 'TRANSIENT'          // e.g. tool timeout; retry with backoff
    | 'PERMANENT'          // e.g. tool does not exist; no retry
    | 'POLICY_VIOLATION'   // e.g. permission denied; log and halt tick
    | 'INVARIANT_BREACH';  // e.g. invalid state transition; halt agent + escalate

export type FailureEvent = {
    agentId: AgentId;
    tickSeq: number;
    class: FailureClass;
    code: string;
    message: string;
    context: SerializableContext;
    timestamp: number;
};

// Internal tracking for transient limit mappings:
export type RecoveryRecord = {
    agentId: AgentId;
    tickSeq: number;
    retryCount: number;
    lastAttempt: number;
};
