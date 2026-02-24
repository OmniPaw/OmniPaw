export type ToolManifest = {
    name: string;
    description: string;
    parameters: Record<string, any>;
};

export type ToolResult =
    | { kind: 'SUCCESS'; data: any }
    | { kind: 'ERROR'; message: string; code?: string };

export type ToolHandler = (agentId: string, args: any) => Promise<ToolResult> | ToolResult;
