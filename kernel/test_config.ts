import { KernelConfig } from './config';

function test() {
    const config = new KernelConfig("LIVE");

    console.log("--- Initial State ---");
    console.log("Mode:", config.getMode());

    console.log("\n--- Testing Immutability ---");
    try {
        // @ts-ignore
        config.mode = "REPLAY";
        console.log("Immutability: FAILED (was able to mutate)");
    } catch (e) {
        console.log("Immutability: OK (mutation prevented)");
    }
}

test();
