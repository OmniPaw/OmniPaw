import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
import { TickEngine, TickInput, Instruction, TickOutput } from '../execution/tick';

dotenv.config();

/**
 * Bridges the gap between Omni's strict Instruction evaluation layer and 
 * unpredictable real-world Non-Deterministic LLMs. 
 */
export class LlmBrainAdapter {
    private openai: OpenAI | null = null;
    private anthropic: Anthropic | null = null;
    private gemini: GoogleGenAI | null = null;
    private activeProvider: 'openai' | 'anthropic' | 'gemini' | 'mock' = 'mock';

    constructor() {
        const openAIApiKey = process.env.OPENAI_API_KEY;
        const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
        const geminiApiKey = process.env.GEMINI_API_KEY;

        if (openAIApiKey && !openAIApiKey.includes('your_api')) {
            this.openai = new OpenAI({ apiKey: openAIApiKey });
            this.activeProvider = 'openai';
        } else if (anthropicApiKey && !anthropicApiKey.includes('your_api')) {
            this.anthropic = new Anthropic({ apiKey: anthropicApiKey });
            this.activeProvider = 'anthropic';
        } else if (geminiApiKey && !geminiApiKey.includes('your_api')) {
            this.gemini = new GoogleGenAI({ apiKey: geminiApiKey });
            this.activeProvider = 'gemini';
        }
    }

    /**
     * Reaches out to the configured LLM requiring deterministic JSON formatting.
     * The OS enforces mapping integrity natively returning `Instructions`.
     */
    async evaluate(agentGoal: string, currentContext: any): Promise<Instruction> {
        // Fallback for secure testing without API boundaries
        if (this.activeProvider === 'mock') {
            console.log("\x1b[90m[LLM Adapter] No valid API keys set. Engaging Sandbox Mappings.\x1b[0m");
            return this.mockEvaluate(agentGoal, currentContext);
        }

        try {
            const systemPrompt = `You are a strict logical processor inside the Omni Agent OS.
CURRENT AGENT GOAL: ${agentGoal}

Below is the dynamic State Context (memory, prior results):
${JSON.stringify(currentContext)}

Based entirely on this goal and state, deduct the singular next required operation.
You must return your output explicitly mapped as ONE of the following precise JSON objects:

1. {"kind": "CALL_TOOL", "toolName": "<name>", "args": {<args>}}
2. {"kind": "RETURN", "value": "<final result string>"}
3. {"kind": "NOOP"}`;

            let content: string | null = null;

            if (this.activeProvider === 'openai' && this.openai) {
                const response = await this.openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'system', content: systemPrompt }],
                    response_format: { type: 'json_object' },
                    temperature: 0.1
                });
                content = response.choices[0].message.content;
            } else if (this.activeProvider === 'anthropic' && this.anthropic) {
                const response = await this.anthropic.messages.create({
                    model: 'claude-3-5-sonnet-20241022',
                    system: systemPrompt,
                    messages: [{ role: 'user', content: 'Determine the next operational Instruction matching the JSON schema.' }],
                    max_tokens: 1024,
                    temperature: 0.1
                });
                const block = response.content[0];
                if (block.type === 'text') {
                    content = block.text;
                }
            } else if (this.activeProvider === 'gemini' && this.gemini) {
                const response = await this.gemini.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: systemPrompt,
                    config: {
                        temperature: 0.1,
                        responseMimeType: 'application/json'
                    }
                });
                content = response.text || null;
            }

            if (!content) throw new Error("Empty LLM completion packet");

            // Clean markdown blocking commonly returned by LLMs when JSON mode isn't strictly enforced
            content = content.trim();
            if (content.startsWith('```json')) {
                content = content.replace(/^```json\n/, '').replace(/\n```$/, '');
            } else if (content.startsWith('```')) {
                content = content.replace(/^```\n/, '').replace(/\n```$/, '');
            }

            const parsed = JSON.parse(content) as any;

            // Optional explicit parsing validation - OmniKernel `TickEngine` will crash deterministically gracefully 
            // if we feed it a broken Instruction interface mapping.
            return parsed as Instruction;

        } catch (error: any) {
            console.error(`\x1b[31m[LLM Error]\x1b[0m Adapter generation trap: ${error.message}`);
            return { kind: "RETURN", value: `KERNEL_PANIC: LLM evaluation crashed determining target Instruction mapping: ${error.message}` };
        }
    }

    private async mockEvaluate(agentGoal: string, currentContext: any): Promise<Instruction> {
        return new Promise((resolve) => {
            setTimeout(() => {
                const stepCount = currentContext.length || 0;

                if (stepCount === 0) {
                    resolve({
                        kind: 'CALL_TOOL',
                        toolName: 'host.fs.list_dir',
                        args: { relativePath: '.' }
                    });
                } else if (stepCount === 1) {
                    resolve({
                        kind: 'CALL_TOOL',
                        toolName: 'host.fs.write_file',
                        args: {
                            relativePath: 'app.js',
                            content: "const express = require('express');\nconst app = express();\n\napp.get('/', (req, res) => res.send('Hello from OmniPaw!'));\napp.listen(3000, () => console.log('Server running...'));"
                        }
                    });
                } else if (stepCount === 2) {
                    resolve({
                        kind: 'CALL_TOOL',
                        toolName: 'host.fs.write_file',
                        args: {
                            relativePath: 'README.md',
                            content: "# Generated by OmniPaw SWE Agent\nThis workspace was autonomously configured securely."
                        }
                    });
                } else {
                    resolve({
                        kind: 'RETURN',
                        value: `Final explicit deductive completion for: ${agentGoal}`
                    });
                }
            }, 300);
        });
    }

    /**
     * Executes the Tick Cycle leveraging the LLM inference synchronously.
     */
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
