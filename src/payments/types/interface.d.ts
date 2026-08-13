export type QueueJob<T> = {
    task: () => Promise<T>;
    resolve: (value: T) => void;
    reject: (error: unknown) => void;
};