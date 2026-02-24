import { AgentId } from '../identity/types';

export type AgentState =
    | 'DEFINED'
    | 'SPAWNED'
    | 'ACTIVE'
    | 'WAITING'
    | 'RESUMABLE'
    | 'COMPLETING'
    | 'FAULTED'
    | 'RECOVERING'
    | 'TERMINATED';

export type TransitionTrigger =
    | 'spawn'
    | 'activate'
    | 'yield'
    | 'await_tool'
    | 'complete'
    | 'error'
    | 'suspend'
    | 'resume'
    | 'timeout'
    | 'expire'
    | 'teardown_ok'
    | 'recover'
    | 'abandon'
    | 'recovery_success'
    | 'recovery_exhausted';

export type LifecycleTransition = {
    from: AgentState;
    to: AgentState;
    trigger: TransitionTrigger;
    timestamp: number;
    busSeq: number;
    meta?: Record<string, unknown>;
};

export type AgentLifecycleRecord = {
    agentId: AgentId;
    transitions: LifecycleTransition[];
};

export const VALID_TRANSITIONS: ReadonlyArray<[AgentState, TransitionTrigger, AgentState]> = [
    ['DEFINED', 'spawn', 'SPAWNED'],
    ['SPAWNED', 'activate', 'ACTIVE'],
    ['ACTIVE', 'yield', 'WAITING'],
    ['ACTIVE', 'await_tool', 'WAITING'],
    ['ACTIVE', 'complete', 'COMPLETING'],
    ['ACTIVE', 'error', 'FAULTED'],
    ['ACTIVE', 'suspend', 'RESUMABLE'],
    ['WAITING', 'resume', 'ACTIVE'],
    ['WAITING', 'timeout', 'FAULTED'],
    ['WAITING', 'error', 'FAULTED'],
    ['RESUMABLE', 'resume', 'ACTIVE'],
    ['RESUMABLE', 'expire', 'TERMINATED'],
    ['COMPLETING', 'teardown_ok', 'TERMINATED'],
    ['FAULTED', 'recover', 'RECOVERING'],
    ['FAULTED', 'abandon', 'TERMINATED'],
    ['RECOVERING', 'recovery_success', 'ACTIVE'],
    ['RECOVERING', 'recovery_exhausted', 'TERMINATED'],
] as const;
