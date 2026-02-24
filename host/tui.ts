import { KernelBus } from '../kernel/bus';
import * as blessed from 'blessed';

export class KernelTUI {
    private screen: blessed.Widgets.Screen;
    private logBox: blessed.Widgets.Log;
    private agentBox: blessed.Widgets.ListElement;
    private memoryBox: blessed.Widgets.TextElement;

    private agents: Set<string> = new Set();

    constructor(private readonly bus: KernelBus) {
        this.screen = blessed.screen({
            smartCSR: true,
            title: 'OmniPaw Kernel Dashboard'
        });

        const header = blessed.box({
            top: 0,
            left: 0,
            width: '100%',
            height: 3,
            content: '{center}{cyan-fg}🔬 OMNIPAW KERNEL VISUAL DASHBOARD 🔬{/cyan-fg}{/center}',
            tags: true,
            style: {
                bg: 'black',
            }
        });

        this.agentBox = blessed.list({
            top: 3,
            left: 0,
            width: '25%',
            height: '100%-3',
            label: ' {bold}Agent Registry{/bold} ',
            tags: true,
            border: { type: 'line' },
            style: { border: { fg: 'cyan' }, selected: { bg: 'blue' } },
            items: []
        });

        this.logBox = blessed.log({
            top: 3,
            left: '25%',
            width: '50%',
            height: '100%-3',
            label: ' {bold}Kernel Bus Events{/bold} ',
            tags: true,
            border: { type: 'line' },
            style: { border: { fg: 'magenta' } },
            scrollback: 1000,
            scrollbar: { ch: ' ', track: { bg: 'grey' }, style: { bg: 'cyan' } }
        });

        this.memoryBox = blessed.text({
            top: 3,
            left: '75%',
            width: '25%',
            height: '100%-3',
            label: ' {bold}Memory State{/bold} ',
            tags: true,
            border: { type: 'line' },
            style: { border: { fg: 'yellow' } }
        });

        this.screen.append(header);
        this.screen.append(this.agentBox);
        this.screen.append(this.logBox);
        this.screen.append(this.memoryBox);

        // Quit on Escape, q, or Control-C.
        this.screen.key(['escape', 'q', 'C-c'], () => {
            return process.exit(0);
        });
    }

    startVisualizer(): void {
        this.bus.subscribe('*', (event) => {
            const time = new Date(event.timestamp).toISOString().split('T')[1].slice(0, 12);
            const prefix = `{gray-fg}[${time}]{/gray-fg}`;

            switch (event.kind) {
                case 'AGENT_SPAWNED':
                    this.agents.add(event.agentId);
                    this.updateAgentList();
                    this.logBox.log(`${prefix} {green-fg}[SPAWN]{/green-fg} Agent [{yellow-fg}${event.agentId}{/yellow-fg}] entered the registry.`);
                    break;
                case 'LIFECYCLE_TRANSITION':
                    const eL = event as any;
                    this.logBox.log(`${prefix} {magenta-fg}[STATE]{/magenta-fg} Agent [{yellow-fg}${event.agentId}{/yellow-fg}] shifted: {gray-fg}${eL.from}{/gray-fg} → {white-fg}${eL.to}{/white-fg} (Trigger: ${eL.trigger})`);
                    break;
                case 'TICK_COMPLETED':
                    const eC = event as any;
                    this.logBox.log(`${prefix} {blue-fg}[TICK]{/blue-fg} Agent [{yellow-fg}${event.agentId}{/yellow-fg}]: Tick #${eC.tickSeq} Finished.`);
                    break;
                case 'TOOL_CALL_REQUESTED':
                    const eT = event as any;
                    this.logBox.log(`${prefix} {cyan-fg}[TOOL ]{/cyan-fg} Agent [{yellow-fg}${event.agentId}{/yellow-fg}] requested: {red-fg}${eT.toolName}{/red-fg}`);
                    break;
                case 'MEMORY_ACCESS':
                    const eM = event as any;
                    this.logBox.log(`${prefix} {yellow-fg}[ MEM ]{/yellow-fg} Agent [{yellow-fg}${event.agentId}{/yellow-fg}] ${eM.action}: ${eM.scope}/${eM.key}`);
                    this.memoryBox.setContent(`{cyan-fg}Last Access:{/cyan-fg}\nScope: ${eM.scope}\nKey: ${eM.key}\nAction: ${eM.action}\nAgent: ${event.agentId}`);
                    break;
                default:
                    this.logBox.log(`${prefix} {gray-fg}[EVENT]{/gray-fg} Generic <${event.kind}> triggered.`);
            }
            this.screen.render();
        });
        this.screen.render();
    }

    private updateAgentList(): void {
        this.agentBox.setItems(Array.from(this.agents));
        this.screen.render();
    }

    renderDivergencePanic(expectedHash: string, actualHash: string): void {
        this.screen.destroy();
        console.log(`\n\x1b[41m\x1b[37m !!! KERNEL PANIC: CRYPTOGRAPHIC DIVERGENCE !!! \x1b[0m`);
        console.log(`\x1b[31mExpected:\x1b[0m ${expectedHash}`);
        console.log(`\x1b[31mActual:  \x1b[0m ${actualHash}`);
        console.log(`\x1b[90mExecution path irrevocably compromised. Halting TickEngine immediately.\x1b[0m\n`);
    }
}
