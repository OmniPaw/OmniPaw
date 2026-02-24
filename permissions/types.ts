import { AgentId } from '../identity/types';

export type PolicyResult = 'ALLOW' | 'DENY' | 'ESCALATE';

export type PermissionGrant = {
    action: string;
    resource: string;
    notAfter?: number; // Optional expiration timestamp (ms since epoch)
};

export type Policy = (
    agentId: AgentId,
    action: string,
    resource: string,
    grants: PermissionGrant[]
) => PolicyResult;
