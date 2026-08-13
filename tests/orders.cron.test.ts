import assert from 'node:assert/strict';
import test from 'node:test';
import { Db, ObjectId } from 'mongodb';
import cron, { ScheduledTask, TaskFn, TaskOptions } from 'node-cron';
import Database from '../src/config/database/mongo';
import { orderDb } from '../src/container';
import { startOverdueOrdersCron } from '../src/crons';
import OrderDB from '../src/orders/db';
import { OrderStatus } from '../src/orders/types/enum';
import Logger from '../src/utils/loggers';

const mutableLogger = Logger as {
    info: (message: unknown, ...args: unknown[]) => void;
    error: (message: unknown, ...args: unknown[]) => void;
};

test('OrderDB marks eligible orders overdue in batches with unique audit IDs', async () => {
    const orderIds = Array.from({ length: 501 }, () => new ObjectId());
    const bulkWriteBatches: any[][] = [];
    let findFilter: any;
    let findOptions: any;
    const originalDatabase = Database.Instance;

    Database.Instance = {
        collection: () => ({
            find: (filter: unknown, options: unknown) => {
                findFilter = filter;
                findOptions = options;
                return {
                    async *[Symbol.asyncIterator]() {
                        for (const _id of orderIds) yield { _id };
                    }
                };
            },
            bulkWrite: async (operations: any[]) => {
                bulkWriteBatches.push([...operations]);
                return { modifiedCount: operations.length };
            }
        })
    } as unknown as Db;

    try {
        const modifiedCount = await new OrderDB().markOverdueOrders();

        assert.equal(modifiedCount, 501);
        assert.deepEqual(bulkWriteBatches.map(batch => batch.length), [500, 1]);
        assert.deepEqual(findOptions, { projection: { _id: 1 } });
        assert.deepEqual(findFilter.status, {
            $in: [OrderStatus.PENDING, OrderStatus.PARTIALLY_PAID]
        });
        assert.ok(findFilter.dueDate.$lt instanceof Date);

        const operations = bulkWriteBatches.flat();
        const auditIds = operations.map(operation =>
            operation.updateOne.update.$push.statusHistory._id.toHexString()
        );

        assert.equal(new Set(auditIds).size, orderIds.length);
        operations.forEach((operation, index) => {
            const { filter, update } = operation.updateOne;

            assert.equal(filter._id, orderIds[index]);
            assert.deepEqual(filter.status, findFilter.status);
            assert.deepEqual(filter.dueDate, findFilter.dueDate);
            assert.equal(update.$set.status, OrderStatus.OVERDUE);
            assert.equal(update.$set.updatedAt, findFilter.dueDate.$lt);
            assert.equal(update.$push.statusHistory.status, OrderStatus.OVERDUE);
            assert.equal(update.$push.statusHistory.createdAt, findFilter.dueDate.$lt);
            assert.match(update.$push.statusHistory.note, /automatically marked overdue/i);
        });
    } finally {
        Database.Instance = originalDatabase;
    }
});

test('OrderDB performs no bulk write when no orders are overdue', async () => {
    let bulkWriteCalls = 0;
    const originalDatabase = Database.Instance;

    Database.Instance = {
        collection: () => ({
            find: () => ({
                async *[Symbol.asyncIterator]() {
                    // No matching orders.
                }
            }),
            bulkWrite: async () => {
                bulkWriteCalls += 1;
                return { modifiedCount: 0 };
            }
        })
    } as unknown as Db;

    try {
        assert.equal(await new OrderDB().markOverdueOrders(), 0);
        assert.equal(bulkWriteCalls, 0);
    } finally {
        Database.Instance = originalDatabase;
    }
});

test('cron schedules the database operation at midnight and logs the modified count', async () => {
    const originalSchedule = cron.schedule;
    const originalMarkOverdueOrders = orderDb.markOverdueOrders;
    const originalInfo = mutableLogger.info;
    let expression: string | undefined;
    let taskFn: TaskFn | string | undefined;
    let options: TaskOptions | undefined;
    let dbCalls = 0;
    const infoLogs: unknown[][] = [];
    const scheduledTask = { stop() {} } as ScheduledTask;

    cron.schedule = ((cronExpression: string, handler: TaskFn | string, taskOptions?: TaskOptions) => {
        expression = cronExpression;
        taskFn = handler;
        options = taskOptions;
        return scheduledTask;
    }) as typeof cron.schedule;
    orderDb.markOverdueOrders = async () => {
        dbCalls += 1;
        return 7;
    };
    mutableLogger.info = (message: unknown, ...args: unknown[]) => {
        infoLogs.push([message, ...args]);
    };

    try {
        const result = startOverdueOrdersCron();

        assert.equal(result, scheduledTask);
        assert.equal(expression, '0 0 * * *');
        assert.equal(options?.noOverlap, true);
        assert.equal(options?.name, 'mark-overdue-orders');
        assert.equal(options?.unref, true);
        assert.equal(typeof taskFn, 'function');

        await (taskFn as TaskFn)({
            date: new Date(),
            dateLocalIso: new Date().toISOString(),
            triggeredAt: new Date()
        });

        assert.equal(dbCalls, 1);
        assert.equal(infoLogs.length, 1);
        assert.equal(infoLogs[0][0], 'Cron marked orders overdue');
        assert.deepEqual(infoLogs[0][1], { modifiedCount: 7 });
    } finally {
        cron.schedule = originalSchedule;
        orderDb.markOverdueOrders = originalMarkOverdueOrders;
        mutableLogger.info = originalInfo;
    }
});

test('cron catches and logs database failures', async () => {
    const originalSchedule = cron.schedule;
    const originalMarkOverdueOrders = orderDb.markOverdueOrders;
    const originalError = mutableLogger.error;
    let taskFn: TaskFn | string | undefined;
    const expectedError = new Error('database unavailable');
    const loggedErrors: unknown[][] = [];

    cron.schedule = ((_expression: string, handler: TaskFn | string) => {
        taskFn = handler;
        return { stop() {} } as ScheduledTask;
    }) as typeof cron.schedule;
    orderDb.markOverdueOrders = async () => {
        throw expectedError;
    };
    mutableLogger.error = (message: unknown, ...args: unknown[]) => {
        loggedErrors.push([message, ...args]);
    };

    try {
        startOverdueOrdersCron();
        assert.equal(typeof taskFn, 'function');

        await (taskFn as TaskFn)({
            date: new Date(),
            dateLocalIso: new Date().toISOString(),
            triggeredAt: new Date()
        });

        assert.equal(loggedErrors.length, 1);
        assert.match(String(loggedErrors[0][0]), /cron failed/i);
        assert.equal(loggedErrors[0][1], expectedError);
    } finally {
        cron.schedule = originalSchedule;
        orderDb.markOverdueOrders = originalMarkOverdueOrders;
        mutableLogger.error = originalError;
    }
});
