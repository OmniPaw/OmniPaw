import { AgentId } from '../identity/types';
import { PermissionGrant, Policy, PolicyResult } from './types';
import { ExecutionLogger } from '../logging/logger';

export class PermissionModel {
    constructor(private readonly logger: ExecutionLogger) { }

    evaluate(
        agentId: AgentId,
        action: string,
        resource: string,
        grants: PermissionGrant[],
        policies: Policy[]
    ): PolicyResult {
        // Check if any grant explicitly allows this evaluated against time.
        const now = Date.now(); // Note: While evaluating policies uses Date.now(), it's safe outside TickEngine evaluation purity loop if the outputs are logged.

        // First, verify if the agent even has a valid grant for this action/resource combination
        let hasValidGrant = false;
        for (const grant of grants) {
            if (
                (grant.action === '*' || grant.action === action) &&
                (grant.resource === '*' || grant.resource === resource)
            ) {
                if (!grant.notAfter || grant.notAfter > now) {
                    hasValidGrant = true;
                    break;
                }
            }
        }

        if (!hasValidGrant) {
            this.logger.append({
                kind: 'PERMISSION_EVALUATION',
                agentId,
                timestamp: Date.now(),
                payload: { action, resource, result: 'DENY', reason: 'NO_VALID_GRANT' }
            });
            return 'DENY';
        }

        // Evaluate against custom policies provided
        // Evaluation order: explicit DENY > explicit ALLOW (handled here as default) > default DENY (handled above)
        let finalResult: PolicyResult = 'ALLOW'; // default to ALLOW since we verified a grant exists

        for (const policy of policies) {
            const result = policy(agentId, action, resource, grants);
            if (result === 'DENY') {
                finalResult = 'DENY';
                break; // explicit DENY immediately halts further checks
            }
            if (result === 'ESCALATE') {
                finalResult = 'ESCALATE'; // ESCALATE overrides ALLOW
            }
        }

        this.logger.append({
            kind: 'PERMISSION_EVALUATION',
            agentId,
            timestamp: Date.now(),
            payload: { action, resource, result: finalResult }
        });

        return finalResult;
    }
}
