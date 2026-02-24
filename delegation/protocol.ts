import { AgentId } from '../identity/types';
import { ExecutionLogger } from '../logging/logger';
import { PermissionGrant } from '../permissions/types';
import {
    DelegationToken,
    DelegationRequest,
    DelegationResponse,
    DelegationTree,
    DelegationNode
} from './types';

export class DelegationProtocol {
    private tree: DelegationTree = { nodes: new Map() };
    private tokenIdCounter = 1;

    constructor(private readonly logger: ExecutionLogger) { }

    initRoot(agentId: AgentId, rootGrants: PermissionGrant[]): void {
        const token: DelegationToken = {
            tokenId: `root-token-${this.tokenIdCounter++}`,
            parentAgentId: agentId,
            childAgentId: agentId,
            grants: rootGrants,
            maxDepth: 100, // root can delegate deep
            ttl: Number.MAX_SAFE_INTEGER,
            revoked: false
        };

        this.tree.nodes.set(agentId, {
            agentId,
            parentId: null,
            children: [],
            token
        });
    }

    private isSubset(subset: PermissionGrant[], superset: PermissionGrant[]): boolean {
        const now = Date.now();
        for (const sub of subset) {
            if (sub.notAfter && sub.notAfter < now) {
                return false; // Can't delegate expired grants
            }

            let covered = false;
            for (const sup of superset) {
                if (sup.notAfter && sup.notAfter < now) continue;

                const actionCovered = sup.action === '*' || sup.action === sub.action;
                const resourceCovered = sup.resource === '*' || sup.resource === sub.resource;
                const timeCovered = !sup.notAfter || (sub.notAfter && sub.notAfter <= sup.notAfter);

                if (actionCovered && resourceCovered && timeCovered) {
                    covered = true;
                    break;
                }
            }
            if (!covered) return false;
        }
        return true;
    }

    delegate(request: DelegationRequest): DelegationResponse {
        const parentNode = this.tree.nodes.get(request.parentAgentId);
        if (!parentNode || !parentNode.token) {
            return { kind: 'REJECTED', reason: 'Parent agent not found or uninitialized' };
        }

        if (parentNode.token.revoked) {
            return { kind: 'REJECTED', reason: 'Parent token is revoked' };
        }

        if (Date.now() > parentNode.token.ttl) {
            return { kind: 'REJECTED', reason: 'Parent token is expired' };
        }

        // Rule 1: grantSubset must be <= parent current grants
        if (!this.isSubset(request.grantSubset, parentNode.token.grants)) {
            return { kind: 'REJECTED', reason: 'Requested grants escape parent bounds' };
        }

        // Rule 2: maxDepth must be < parent
        if (request.maxDepth >= parentNode.token.maxDepth) {
            return { kind: 'REJECTED', reason: 'Requested maxDepth exceeds parent allowance' };
        }

        // Ensure TTL does not exceed parent TTL
        if (request.ttl > parentNode.token.ttl) {
            return { kind: 'REJECTED', reason: 'Requested ttl exceeds parent ttl' };
        }

        const childAgentId = `child-${request.parentAgentId}-${this.tokenIdCounter++}`;
        const tokenId = `token-${this.tokenIdCounter++}`;

        const token: DelegationToken = {
            tokenId,
            parentAgentId: request.parentAgentId,
            childAgentId,
            grants: request.grantSubset,
            maxDepth: request.maxDepth,
            ttl: request.ttl,
            revoked: false
        };

        const childNode: DelegationNode = {
            agentId: childAgentId,
            parentId: request.parentAgentId,
            children: [],
            token
        };

        parentNode.children.push(childAgentId);
        this.tree.nodes.set(childAgentId, childNode);

        // Rule 6: Logging the delegation event
        this.logger.append({
            kind: 'DELEGATION_ISSUED',
            agentId: request.parentAgentId,
            timestamp: Date.now(),
            payload: { request, token }
        });

        return { kind: 'ACCEPTED', token, childAgentId };
    }

    revoke(agentId: AgentId): void {
        const node = this.tree.nodes.get(agentId);
        if (!node || !node.token || node.token.revoked) return;

        // Rule 3: Revocation is immediate
        node.token.revoked = true;

        this.logger.append({
            kind: 'DELEGATION_REVOKED',
            agentId,
            timestamp: Date.now(),
            payload: { tokenId: node.token.tokenId }
        });

        // Rule 3: Cascades depth-first
        for (const childId of node.children) {
            this.revoke(childId);
        }
    }

    getToken(agentId: AgentId): DelegationToken | null {
        const node = this.tree.nodes.get(agentId);
        return node ? node.token : null;
    }
}
