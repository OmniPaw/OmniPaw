import { TickEngine, TickInput, Instruction, TickOutput } from '../../execution/tick';

export class OllamaAdapter {
    private baseUrl: string;
    private model: string;

    constructor(baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434', model = process.env.OLLAMA_MODEL || 'llama3') {
        this.baseUrl = baseUrl;
        this.model = model;
    }

    async evaluate(agentGoal: string, currentContext: any): Promise<Instruction> {
        const systemPrompt = `You are a strict logical processor inside the OmniPaw Agent OS.
CURRENT AGENT GOAL: ${agentGoal}

Below is the dynamic State Context:
${JSON.stringify(currentContext)}

Based entirely on this goal and state, deduct the singular next required operation.
You must return your output explicitly mapped as ONE of the following precise JSON objects:

1. {"kind": "CALL_TOOL", "toolName": "<name>", "args": {<args>}}
2. {"kind": "RETURN", "value": "<final result string>"}
3. {"kind": "NOOP"}`;

        try {
            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.model,
                    prompt: systemPrompt,
                    stream: false,
                    format: 'json'
                })
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.statusText}`);
            }

            const data = await response.json();
            let content = data.response;

            if (!content) throw new Error("Empty LLM completion packet");

            // Robust JSON extraction fallback
            const parsed = this.parseBrokenJson(content);
            return parsed as Instruction;

        } catch (error: any) {
            console.error(`\x1b[31m[Ollama Error]\x1b[0m Adapter generation trap: ${error.message}`);
            return { kind: "RETURN", value: `KERNEL_PANIC: LLM evaluation crashed determining target Instruction mapping: ${error.message}` };
        }
    }

    public parseBrokenJson(content: string): any {
        content = content.trim();
        if (content.startsWith('```json')) {
            content = content.replace(/^```json\n/, '').replace(/\n```$/, '');
        } else if (content.startsWith('```')) {
            content = content.replace(/^```\n/, '').replace(/\n```$/, '');
        }

        try {
            return JSON.parse(content);
        } catch (e) {
            // Regex fallback for broken JSON specifically targeting instruction schema
            const kindMatch = content.match(/"?kind"?\s*:\s*"?([A-Z_]+)"?/);
            if (!kindMatch) {
                return { kind: "NOOP" }; // Safest fallback
            }

            const kind = kindMatch[1];
            if (kind === 'CALL_TOOL') {
                const toolMatch = content.match(/"?toolName"?\s*:\s*"?([^"]+)"?/);
                return {
                    kind: 'CALL_TOOL',
                    toolName: toolMatch ? toolMatch[1] : 'unknown',
                    args: {} // Args recovery is too volatile for regex, returning empty args
                };
            }
            if (kind === 'RETURN') {
                const valMatch = content.match(/"?value"?\s*:\s*"?([^"]+)"?/);
                return {
                    kind: 'RETURN',
                    value: valMatch ? valMatch[1] : ''
                };
            }
            return { kind: "NOOP" };
        }
    }

    async spinTickRound(tickEngine: TickEngine, agentId: string, sequenceNumber: number, agentGoal: string, memoryContext: any): Promise<TickOutput> {
        const dynamicInstruction = await this.evaluate(agentGoal, memoryContext);

        const input: TickInput = {
            agentId,
            sequenceNumber,
            instruction: dynamicInstruction,
            maxSteps: 10
        };

        return tickEngine.runTick(input);
    }
}
