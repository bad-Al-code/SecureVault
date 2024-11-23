export class CustomRandom {
    private static seed: number;

    static initialize(): void {
        const currentTime = Date.now();
        const pid = process.pid;
        this.seed = currentTime ^ pid;
    }

    static next(): number {
        const a = 1103515245;
        const c = 12345;
        const m = Math.pow(2, 31);

        this.seed = (a * this.seed + c) % m;
        return this.seed;
    }

    static randomBytes(size: number): Buffer {
        const buffer = Buffer.alloc(size);
        for (let i = 0; i < size; i++) {
            buffer[i] = this.next() % 256;
        }
        return buffer;
    }
}
