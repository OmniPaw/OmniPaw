import { AgentId } from '../identity/types';
import { PermissionGrant } from '../permissions/types';

export type DelegationToken = {
    tokenId: string; // UUID, globally unique
    parentAgentId: AgentId;
    childAgentId: AgentId; // assigned at delegation time
    grants: PermissionGrant[]; // subset of parent's grants (never a superset)
    maxDepth: number; // how many further delegations are allowed
    ttl: number; // absolute expiry timestamp (ms since epoch)
    revoked: boolean; // set to true on revocation; immutable thereafter
};

export type TaskSpec = {
    instruction: string;
};

export type DelegationRequest = {
    requestId: string;
    parentAgentId: AgentId;
    taskSpec: TaskSpec; // what the child should do
    grantSubset: PermissionGrant[]; // what permissions to delegate
    maxDepth: number;
    ttl: number;
};

export type DelegationResponse =
    | { kind: 'ACCEPTED'; token: DelegationToken; childAgentId: AgentId }
    | { kind: 'REJECTED'; reason: string };

export type DelegationTree = {
    nodes: Map<AgentId, DelegationNode>;
};

export type DelegationNode = {
    agentId: AgentId;
    parentId: AgentId | null; // null = root agent
    children: AgentId[];
    token: DelegationToken | null;
};
