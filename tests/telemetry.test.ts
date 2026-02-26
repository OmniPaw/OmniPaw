import { TelemetryProvider } from '../host/telemetry/provider';
import { TickEngine } from '../execution/tick';
import { ToolGate } from '../tools/gate';
import { ExecutionLogger } from '../logging/logger';
import { KernelConfig } from '../kernel/config';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { AggregationTemporality, InMemoryMetricExporter, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';

describe('OpenTelemetry Observability', () => {
    let telemetry: TelemetryProvider;
    let spanExporter: InMemorySpanExporter;
    let metricExporter: InMemoryMetricExporter;
    let spanProcessor: SimpleSpanProcessor;
    let metricReader: any;
    let sdk: NodeSDK;

    beforeAll(async () => {
        // Setup in-memory exporters for testing
        spanExporter = new InMemorySpanExporter();
        metricExporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
        spanProcessor = new SimpleSpanProcessor(spanExporter);
        metricReader = new PeriodicExportingMetricReader({
            exporter: metricExporter,
            exportIntervalMillis: 10000
        });

        sdk = new NodeSDK({
            resource: resourceFromAttributes({ 'service.name': 'test-omnipaw' }),
            traceExporter: spanExporter,
            spanProcessor: spanProcessor,
            metricReader: metricReader
        });

        sdk.start();

        // Reset singleton to force re-initialization AFTER the global SDK is started.
        // This bypasses bugs in OpenTelemetry's proxy provider for synchronous metrics.
        (TelemetryProvider as any).instance = undefined;
        telemetry = TelemetryProvider.getInstance();
    });

    afterAll(async () => {
        if (sdk) {
            try { await sdk.shutdown(); } catch (e) { /* ignore */ }
        }
    });

    beforeEach(() => {
        spanExporter.reset();
        metricExporter.reset();
    });

    test('TickEngine should create spans and increment tick counter', async () => {
        const engine = new TickEngine();
        const result = engine.runTick({
            agentId: 'agent-123',
            sequenceNumber: 1,
            instruction: { kind: 'RETURN', value: 'done' },
            maxSteps: 10
        });

        expect(result.kind).toBe('COMPLETED');

        await spanProcessor.forceFlush();

        const spans = spanExporter.getFinishedSpans();
        expect(spans).toHaveLength(1);
        expect(spans[0].name).toBe('TickEngine.runTick [1]');
        expect(spans[0].attributes['agent.id']).toBe('agent-123');
        expect(spans[0].attributes['tick.result']).toBe('COMPLETED');
    });

    test('ToolGate should create spans, measure latency, and increment counter', async () => {
        const logger = new ExecutionLogger();
        const config = new KernelConfig('LIVE');
        const handlers = {
            'test.delay': async () => {
                return new Promise(r => setTimeout(() => r('ok'), 50));
            }
        };

        const gate = new ToolGate(logger, config, handlers);

        const result = await gate.execute('agent-456', 2, 'test.delay', {});
        expect(result).toBe('ok');

        const spans = spanExporter.getFinishedSpans();
        expect(spans).toHaveLength(1);
        expect(spans[0].name).toBe('ToolGate.execute [test.delay]');
        expect(spans[0].attributes['tool.result']).toBe('SUCCESS');

        const latency = spans[0].attributes['tool.latency_ms'] as number;
        expect(latency).toBeGreaterThanOrEqual(49);
    });

    test('ToolGate should trace exceptions correctly', async () => {
        const logger = new ExecutionLogger();
        const config = new KernelConfig('LIVE');
        const handlers = {
            'test.fail': () => { throw new Error('Boom'); }
        };

        const gate = new ToolGate(logger, config, handlers);

        await expect(gate.execute('agent-789', 3, 'test.fail', {})).rejects.toThrow('Boom');

        const spans = spanExporter.getFinishedSpans();
        expect(spans).toHaveLength(1);
        expect(spans[0].attributes['error']).toBe(true);
        expect(spans[0].events).toHaveLength(1); // Exception event
    });

    test('Metrics should be updated correctly', async () => {
        // Trigger a tick to increment the metric
        const engine = new TickEngine();
        engine.runTick({
            agentId: 'agent-metric-1',
            sequenceNumber: 1,
            instruction: { kind: 'NOOP' },
            maxSteps: 10
        });

        // Collect metrics directly from the reader
        const { resourceMetrics, errors } = await metricReader.collect();
        expect(errors).toHaveLength(0);
        expect(resourceMetrics).toBeDefined();
        expect(resourceMetrics.scopeMetrics.length).toBeGreaterThan(0);

        // Find the 'omnipaw.ticks.total' metric
        const scopeMetrics = resourceMetrics.scopeMetrics;
        let tickMetric: any = null;

        for (const scope of scopeMetrics) {
            for (const metric of scope.metrics) {
                if (metric.descriptor.name === 'omnipaw.ticks.total') {
                    tickMetric = metric;
                }
            }
        }

        expect(tickMetric).not.toBeNull();
        expect(tickMetric.dataPoints).toBeDefined();

        const point = tickMetric.dataPoints.find((dp: any) => dp.attributes['agentId'] === 'agent-metric-1');
        expect(point).toBeDefined();
        expect(point.value).toBeGreaterThanOrEqual(1);
    });
});
