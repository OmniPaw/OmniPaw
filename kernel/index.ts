import { KernelBus } from './bus';
import { AgentRegistry } from '../identity/registry';
import { ExecutionLogger } from '../logging/logger';
import { LifecycleController } from '../lifecycle/controller';
import { PermissionModel } from '../permissions/model';
import { SharedStore } from '../memory/shared';
import { PersistentStore } from '../memory/persistent';
import { EphemeralStore } from '../memory/ephemeral';
import { DelegationProtocol } from '../delegation/protocol';
import { FailureHandler, ILifecycleController } from '../failure/handler';

export class OmniKernel {
    public readonly bus: KernelBus;
    public readonly registry: AgentRegistry;
    public readonly logger: ExecutionLogger;
    public readonly lifecycle: LifecycleController;
    public readonly permissions: PermissionModel;
    public readonly sharedStore: SharedStore;
    public readonly persistentStore: PersistentStore;
    public readonly ephemeralStore: EphemeralStore;
    public readonly delegation: DelegationProtocol;
    public readonly failureHandler: FailureHandler;

    constructor(injectedLogger?: ExecutionLogger) {
        this.bus = new KernelBus();

        // Core Logging & Identity
        this.logger = injectedLogger || new ExecutionLogger();
        this.registry = new AgentRegistry();

        // Lifecycle
        this.lifecycle = new LifecycleController(this.logger);

        // Permissions & Delegation
        this.permissions = new PermissionModel(this.logger);
        this.delegation = new DelegationProtocol(this.logger);

        // Memory
        this.ephemeralStore = new EphemeralStore();
        this.persistentStore = new PersistentStore(this.logger);
        this.sharedStore = new SharedStore(this.logger, this.permissions);

        // Failure handling
        // We map a lightweight wrapper to adapt LifecycleController to ILifecycleController interface required by FailureHandler
        const lifecycleAdapter: ILifecycleController = {
            transition: (agentId, state) => this.lifecycle.transition(agentId, state as any)
        };

        this.failureHandler = new FailureHandler(
            this.logger,
            lifecycleAdapter,
            this.delegation,
            3 // Max Transient Retries
        );
    }
}
