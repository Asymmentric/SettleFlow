import { QueueJob } from './types/interface';

export default class PaymentQueue<T> {
    private readonly queues = new Map<string, QueueJob<T>[]>();
    private readonly processing = new Set<string>();

    public enqueue(key: string, task: () => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const job: QueueJob<T> = {
                task,
                resolve,
                reject,
            };

            const queue = this.queues.get(key);

            if (queue) {
                queue.push(job);
            } else {
                this.queues.set(key, [job]);
            }

            if (!this.processing.has(key)) {
                void this.process(key);
            }
        });
    }

    private async process(key: string): Promise<void> {
        if (this.processing.has(key)) {
            return;
        }

        this.processing.add(key);

        try {
            while (true) {
                const queue = this.queues.get(key);
                const job = queue?.shift();

                if (!job) {
                    break;
                }

                try {
                    const result = await job.task();
                    job.resolve(result);
                } catch (error) {
                    job.reject(error);
                }
            }
        } finally {
            this.processing.delete(key);
            this.queues.delete(key);
        }
    }
}