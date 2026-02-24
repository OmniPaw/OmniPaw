import { KernelTUI } from '../host/tui';
import { KernelBus } from '../kernel/bus';
import * as blessed from 'blessed';

jest.mock('blessed', () => {
    const mockScreen = {
        append: jest.fn(),
        key: jest.fn(),
        render: jest.fn(),
        destroy: jest.fn()
    };
    return {
        screen: jest.fn(() => mockScreen),
        box: jest.fn(() => ({})),
        list: jest.fn(() => ({
            setItems: jest.fn()
        })),
        log: jest.fn(() => ({
            log: jest.fn()
        })),
        text: jest.fn(() => ({
            setContent: jest.fn()
        }))
    };
});

describe('KernelTUI', () => {
    let bus: KernelBus;
    let tui: KernelTUI;

    beforeEach(() => {
        bus = new KernelBus();
        tui = new KernelTUI(bus);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should initialize blessed components on construction', () => {
        expect(blessed.screen).toHaveBeenCalled();
        expect(blessed.box).toHaveBeenCalled();
        expect(blessed.list).toHaveBeenCalled();
        expect(blessed.log).toHaveBeenCalled();
        expect(blessed.text).toHaveBeenCalled();
    });

    test('should subscribe to bus events on startVisualizer', () => {
        const spy = jest.spyOn(bus, 'subscribe');
        tui.startVisualizer();
        expect(spy).toHaveBeenCalledWith('*', expect.any(Function));
    });

    test('should render updates on AGENT_SPAWNED event', () => {
        tui.startVisualizer();
        bus.emit({
            kind: 'AGENT_SPAWNED',
            agentId: 'a1',
            timestamp: Date.now()
        } as any);
        const screenMock = (blessed.screen as jest.Mock).mock.results[0].value;
        expect(screenMock.render).toHaveBeenCalled();
    });

    test('renderDivergencePanic should destroy screen and dump error', () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        const screenMock = (blessed.screen as jest.Mock).mock.results[0].value;

        tui.renderDivergencePanic('mock-hash-1', 'mock-hash-2');
        expect(screenMock.destroy).toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
    });
});
