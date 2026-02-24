import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { metrics, trace, Tracer, Meter, Counter, Histogram } from '@opentelemetry/api';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader, ConsoleMetricExporter } from '@opentelemetry/sdk-metrics';

/**
 * Singleton providing OpenTelemetry Tracer and Meter instances.
 * Routes telemetry to an OTLP endpoint if configured, otherwise falls back to console.
 */
export class TelemetryProvider {
    private static instance: TelemetryProvider;
    private sdk: NodeSDK | null = null;

    public readonly tracer: Tracer;
    public readonly meter: Meter;

    // Custom Metrics
    public readonly tickCounter: Counter;
    public readonly toolCallCounter: Counter;
    public readonly agentSpawnCounter: Counter;
    public readonly toolExecutionLatency: Histogram;

    private constructor() {
        // Initialize Tracer / Meter APIs
        this.tracer = trace.getTracer('omnipaw-kernel');
        this.meter = metrics.getMeter('omnipaw-kernel');

        // Initialize Metrics
        this.tickCounter = this.meter.createCounter('omnipaw.ticks.total', {
            description: 'Total number of execution ticks processed'
        });
        this.toolCallCounter = this.meter.createCounter('omnipaw.tools.total', {
            description: 'Total number of tool calls requested'
        });
        this.agentSpawnCounter = this.meter.createCounter('omnipaw.agents.spawns', {
            description: 'Total number of agents spawned'
        });
        this.toolExecutionLatency = this.meter.createHistogram('omnipaw.tools.latency_ms', {
            description: 'Latency of tool executions in milliseconds',
            unit: 'ms'
        });
    }

    public static getInstance(): TelemetryProvider {
        if (!TelemetryProvider.instance) {
            TelemetryProvider.instance = new TelemetryProvider();
        }
        return TelemetryProvider.instance;
    }

    /**
     * Boot the OpenTelemetry SDK. Should be called during kernel initialization.
     */
    public start(): void {
        const endpoint = process.env.OTLP_ENDPOINT; // e.g., http://localhost:4318

        const resource = resourceFromAttributes({
            [SEMRESATTRS_SERVICE_NAME]: 'omnipaw-agent-os',
            [SEMRESATTRS_SERVICE_VERSION]: '1.0.0',
        });

        const traceExporter = endpoint
            ? new OTLPTraceExporter({ url: `${endpoint}/v1/traces` })
            : new ConsoleSpanExporter();

        const metricReader = new PeriodicExportingMetricReader({
            exporter: endpoint
                ? new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` })
                : new ConsoleMetricExporter(),
            exportIntervalMillis: 10000
        });

        this.sdk = new NodeSDK({
            resource,
            traceExporter,
            metricReader,
        });

        this.sdk.start();
    }

    public async shutdown(): Promise<void> {
        if (this.sdk) {
            await this.sdk.shutdown();
        }
    }
}
