import { exec } from 'child_process';
import * as path from 'path';

export const HostGitTools = {
    'host.git.clone': {
        execute: async (args: any, config?: any): Promise<any> => {
            const repoUrl = args.url;
            const targetDir = args.directory || path.basename(repoUrl, '.git');

            // Constrain clone targets to the .workspace directory
            const safePath = path.resolve('.workspace', targetDir);

            return new Promise((resolve, reject) => {
                exec(`git clone ${repoUrl} ${safePath}`, (error, stdout, stderr) => {
                    if (error) {
                        return resolve({ error: error.message, stderr });
                    }
                    resolve({
                        success: true,
                        stdout,
                        clonedPath: safePath
                    });
                });
            });
        }
    },
    'host.git.commit': {
        execute: async (args: any, config?: any): Promise<any> => {
            const message = args.message;
            const cwd = args.cwd ? path.resolve('.workspace', args.cwd) : path.resolve('.workspace');

            return new Promise((resolve) => {
                exec(`git add . && git commit -m "${message}"`, { cwd }, (error, stdout, stderr) => {
                    if (error) {
                        return resolve({ error: error.message, stderr });
                    }
                    resolve({
                        success: true,
                        stdout
                    });
                });
            });
        }
    },
    'host.git.log': {
        execute: async (args: any, config?: any): Promise<any> => {
            const cwd = args.cwd ? path.resolve('.workspace', args.cwd) : path.resolve('.workspace');
            const n = args.maxCount || 5;

            return new Promise((resolve) => {
                exec(`git log -n ${n} --oneline`, { cwd }, (error, stdout, stderr) => {
                    if (error) {
                        return resolve({ error: error.message, stderr });
                    }
                    resolve({
                        success: true,
                        logs: stdout.split('\n').filter(l => l.trim().length > 0)
                    });
                });
            });
        }
    }
};
