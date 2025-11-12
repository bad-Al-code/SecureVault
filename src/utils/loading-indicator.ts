export class LoadingIndicator {
    private static readonly SPINNER_FRAMES = [
        '⠋',
        '⠙',
        '⠹',
        '⠸',
        '⠼',
        '⠴',
        '⠦',
        '⠧',
        '⠇',
        '⠏',
    ];
    private intervalId: NodeJS.Timeout | null = null;
    private currentFrame = 0;

    /**
     * Starts the loading spinner with a message
     * @param message The message to display alongside the spinner.
     */
    public start(message: string): void {
        this.intervalId = setInterval(() => {
            const spinner = LoadingIndicator.SPINNER_FRAMES[this.currentFrame];
            process.stdout.write(`\r${spinner} ${message}`);
            this.currentFrame =
                (this.currentFrame + 1) %
                LoadingIndicator.SPINNER_FRAMES.length;
        }, 80);
    }

    /**
     * Stops the loading spinner and optionally displays a final message
     * @param finalMessage The final message to display after stopping.
     */
    public stop(finalMessage?: string): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);

            process.stdout.write('\r\x1b[K');

            if (finalMessage) {
                console.log(finalMessage);
            }
        }
    }
}
