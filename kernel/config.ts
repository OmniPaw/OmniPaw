export type KernelMode = "LIVE" | "REPLAY";

export class KernelConfig {
    private readonly mode: KernelMode;

    constructor(mode: KernelMode) {
        this.mode = mode;
        Object.freeze(this);
    }

    getMode(): KernelMode {
        return this.mode;
    }
}
