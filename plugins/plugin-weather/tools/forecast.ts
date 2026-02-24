import { ToolResult } from '../../../tools/types';

/**
 * Simulated weather forecast tool.
 * In production, this would call a real weather API (requires 'network' permission).
 */
export function getForecast(agentId: string, args: any): ToolResult {
    const city = args.city;

    if (!city || typeof city !== 'string') {
        return { kind: 'ERROR', message: 'Missing or invalid "city" parameter.' };
    }

    // Deterministic mock data for testing
    const forecasts: Record<string, any> = {
        'london': { temp: 12, condition: 'Cloudy', humidity: 78 },
        'tokyo': { temp: 24, condition: 'Sunny', humidity: 55 },
        'new york': { temp: 18, condition: 'Partly Cloudy', humidity: 62 },
    };

    const key = city.toLowerCase();
    const data = forecasts[key] || { temp: 20, condition: 'Unknown', humidity: 50 };

    return {
        kind: 'SUCCESS',
        data: JSON.stringify({ city, forecast: data })
    };
}
