import Docker from 'dockerode';

export class DockerSandbox {
    private docker: Docker;
    private image: string;

    constructor(image: string = 'alpine:latest') {
        this.docker = new Docker(); // Connects to local docker socket
        this.image = image;
    }

    /**
     * Pulls the image if not already present.
     */
    async initialize(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.docker.pull(this.image, (err: any, stream: any) => {
                if (err) return reject(err);

                this.docker.modem.followProgress(stream, (followErr: any, output: any) => {
                    if (followErr) return reject(followErr);
                    resolve();
                }, (event: any) => { });
            });
        });
    }

    /**
     * Executes a command within an ephemeral container and returns stdout/stderr.
     */
    async execute(command: string, timeoutMs: number = 5000): Promise<string> {
        let container: Docker.Container | null = null;
        let isTimeout = false;

        const timer = setTimeout(async () => {
            isTimeout = true;
            if (container) {
                try {
                    await container.kill();
                } catch (e) {
                    // Ignore kill errors
                }
            }
        }, timeoutMs);

        try {
            container = await this.docker.createContainer({
                Image: this.image,
                Cmd: ['sh', '-c', command],
                Tty: false,
                HostConfig: {
                    Memory: 128 * 1024 * 1024, // 128MB limit
                    NetworkMode: 'none' // Disable networking for safety
                }
            });

            // Start container
            await container.start();

            // Wait for it to finish and gather output via logs
            await container.wait();

            if (isTimeout) {
                throw new Error(`Timeout of ${timeoutMs}ms exceeded`);
            }

            const logs = await container.logs({
                stdout: true,
                stderr: true,
                follow: false,
            });

            let result = '';
            // logs is a Buffer if Tty: false
            if (Buffer.isBuffer(logs)) {
                for (let i = 0; i < logs.length;) {
                    if (i + 8 > logs.length) break;
                    const length = logs.readUInt32BE(i + 4);
                    if (i + 8 + length > logs.length) break;
                    result += logs.toString('utf8', i + 8, i + 8 + length);
                    i += 8 + length;
                }
            } else {
                result = (logs as any).toString();
            }

            return result;
        } finally {
            clearTimeout(timer);
            if (container) {
                try {
                    await container.remove({ force: true });
                } catch (e) { }
            }
        }
    }
}
