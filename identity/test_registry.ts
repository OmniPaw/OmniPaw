import { AgentRegistry } from './registry';

const registry = new AgentRegistry();
registry.registerAgent({ id: "a1", type: "ROOT", createdAt: Date.now() });
console.log(registry.getAgent("a1"));
