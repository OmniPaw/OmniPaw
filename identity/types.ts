export type AgentId = string;

export type AgentIdentity = Readonly<{
    id: AgentId;
    type: string;
    createdAt: number;
    name?: string;
    version?: string;
}>;
