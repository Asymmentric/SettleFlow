import assert from 'node:assert/strict';
import test from 'node:test';
import { Db, ObjectId } from 'mongodb';
import Database from '../src/config/database/mongo';
import OrderDB from '../src/orders/db';
import OrderService from '../src/orders/service';
import { OrderStatus } from '../src/orders/types/enum';
import { IOrder, IPaymentDB } from '../src/orders/types/interface';
import AnotherError from '../src/utils/errors/anotherError';

const delay = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

function createOrder(overrides: Partial<IOrder> = {}): IOrder {
    const now = new Date();
    return {
        _id: new ObjectId(),
        userId: new ObjectId(),
        dueDate: new Date(now.getTime() + 86_400_000),
        status: OrderStatus.PENDING,
        lineItems: [],
        payments: [],
        statusHistory: [],
        orderTotal: 10_000,
        paymentsTotal: 0,
        createdAt: now,
        updatedAt: now,
        ...overrides,
    };
}

class InMemoryPaymentDB {
    public activeWrites = 0;
    public maxConcurrentWrites = 0;
    public synchronizeFirstTwoReads = false;

    private initialReadCount = 0;
    private releaseInitialReads: (() => void) | undefined;
    private readonly initialReadsReady = new Promise<void>(resolve => {
        this.releaseInitialReads = resolve;
    });

    constructor(public order: IOrder) {}

    private snapshot(): IOrder {
        return {
            ...this.order,
            lineItems: this.order.lineItems.map(item => ({ ...item })),
            payments: this.order.payments.map(payment => ({ ...payment })),
            statusHistory: this.order.statusHistory.map(entry => ({ ...entry })),
        };
    }

    public async getOrderById(): Promise<IOrder> {
        const snapshot = this.snapshot();

        if (this.synchronizeFirstTwoReads && this.initialReadCount < 2) {
            this.initialReadCount += 1;
            if (this.initialReadCount === 2) this.releaseInitialReads?.();
            await this.initialReadsReady;
        }

        return snapshot;
    }

    public async addPayment(payment: IPaymentDB): Promise<IOrder | null> {
        this.activeWrites += 1;
        this.maxConcurrentWrites = Math.max(this.maxConcurrentWrites, this.activeWrites);
        await delay(8);

        try {
            const nextTotal = this.order.paymentsTotal + payment.amount;
            if (nextTotal > this.order.orderTotal) return null;

            const status = nextTotal === this.order.orderTotal
                ? OrderStatus.PAID
                : this.order.dueDate < payment.updatedAt
                    ? OrderStatus.OVERDUE
                    : OrderStatus.PARTIALLY_PAID;

            this.order = {
                ...this.order,
                paymentsTotal: nextTotal,
                status,
                payments: [...this.order.payments, {
                    _id: payment._id,
                    amount: payment.amount,
                    date: payment.date,
                    note: payment.note,
                    createdAt: payment.createdAt,
                    updatedAt: payment.updatedAt,
                }],
                statusHistory: [...this.order.statusHistory, {
                    _id: new ObjectId(),
                    status,
                    paymentId: payment._id,
                    createdAt: payment.createdAt,
                    updatedAt: payment.updatedAt,
                }],
                updatedAt: payment.updatedAt,
            };

            return this.snapshot();
        } finally {
            this.activeWrites -= 1;
        }
    }
}

function serviceFor(db: InMemoryPaymentDB): OrderService {
    return new OrderService(db as unknown as OrderDB);
}

function paymentFor(order: IOrder, amount: number) {
    return { userId: order.userId, orderId: order._id, amount };
}

function isApiError(statusCode: number, message: RegExp) {
    return (error: unknown): boolean => {
        assert.ok(error instanceof AnotherError);
        assert.equal(error.statusCode, statusCode);
        assert.match(error.message, message);
        return true;
    };
}

test('allocates a partial payment and transitions a pending order to partially paid', async () => {
    const order = createOrder();
    const db = new InMemoryPaymentDB(order);

    const updated = await serviceFor(db).addPayment(paymentFor(order, 4_000));

    assert.equal(updated?.paymentsTotal, 4_000);
    assert.equal(updated?.payments.length, 1);
    assert.equal(updated?.payments[0].amount, 4_000);
    assert.equal(updated?.status, OrderStatus.PARTIALLY_PAID);
});

test('transitions an order from partially paid to paid when the balance is settled', async () => {
    const order = createOrder();
    const db = new InMemoryPaymentDB(order);
    const service = serviceFor(db);

    await service.addPayment(paymentFor(order, 4_000));
    const settled = await service.addPayment(paymentFor(order, 6_000));

    assert.equal(settled?.paymentsTotal, order.orderTotal);
    assert.equal(settled?.payments.length, 2);
    assert.equal(settled?.status, OrderStatus.PAID);
    assert.deepEqual(settled?.statusHistory.map(entry => entry.status), [
        OrderStatus.PARTIALLY_PAID,
        OrderStatus.PAID,
    ]);
});

test('keeps a partially settled past-due order in overdue status', async () => {
    const order = createOrder({ dueDate: new Date(Date.now() - 86_400_000) });
    const db = new InMemoryPaymentDB(order);

    const updated = await serviceFor(db).addPayment(paymentFor(order, 2_500));

    assert.equal(updated?.paymentsTotal, 2_500);
    assert.equal(updated?.status, OrderStatus.OVERDUE);
});

test('rejects an over-payment without allocating any money', async () => {
    const order = createOrder();
    const db = new InMemoryPaymentDB(order);

    await assert.rejects(
        serviceFor(db).addPayment(paymentFor(order, 10_001)),
        isApiError(400, /exceeds the order total/i),
    );
    assert.equal(db.order.paymentsTotal, 0);
    assert.equal(db.order.payments.length, 0);
});

test('serializes simultaneous payments for the same order in one service process', async () => {
    const order = createOrder();
    const db = new InMemoryPaymentDB(order);
    const service = serviceFor(db);

    const results = await Promise.all([
        service.addPayment(paymentFor(order, 5_000)),
        service.addPayment(paymentFor(order, 5_000)),
    ]);

    assert.equal(results[1]?.status, OrderStatus.PAID);
    assert.equal(db.order.paymentsTotal, 10_000);
    assert.equal(db.order.payments.length, 2);
    assert.equal(db.maxConcurrentWrites, 1);
});

test('rejects the losing payment when concurrent server processes exceed the balance', async () => {
    const order = createOrder();
    const db = new InMemoryPaymentDB(order);
    db.synchronizeFirstTwoReads = true;

    // Separate service instances model separate application processes. Their
    // in-memory queues cannot coordinate, so the database guard must decide.
    const outcomes = await Promise.allSettled([
        serviceFor(db).addPayment(paymentFor(order, 6_000)),
        serviceFor(db).addPayment(paymentFor(order, 6_000)),
    ]);

    assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(outcomes.filter(result => result.status === 'rejected').length, 1);
    const rejected = outcomes.find(result => result.status === 'rejected');
    assert.ok(rejected && rejected.status === 'rejected');
    assert.ok(isApiError(400, /remaining amount of 4000 only/i)(rejected.reason));
    assert.equal(db.order.paymentsTotal, 6_000);
    assert.equal(db.order.payments.length, 1);
    assert.equal(db.maxConcurrentWrites, 2);
});

test('Mongo payment allocation atomically guards the balance and defines every status transition', async () => {
    let capturedFilter: any;
    let capturedUpdate: any;
    let capturedOptions: any;
    const originalDatabase = Database.Instance;
    const fakeDatabase = {
        collection: () => ({
            findOneAndUpdate: async (filter: unknown, update: unknown, options: unknown) => {
                capturedFilter = filter;
                capturedUpdate = update;
                capturedOptions = options;
                return null;
            },
        }),
    };
    Database.Instance = fakeDatabase as unknown as Db;

    try {
        const now = new Date();
        await new OrderDB().addPayment({
            _id: new ObjectId(),
            orderId: new ObjectId(),
            userId: new ObjectId(),
            amount: 6_000,
            date: now,
            createdAt: now,
            updatedAt: now,
        });
    } finally {
        Database.Instance = originalDatabase;
    }

    assert.deepEqual(capturedFilter.$expr.$lte, [
        { $add: ['$paymentsTotal', 6_000] },
        '$orderTotal',
    ]);
    assert.deepEqual(
        capturedUpdate[1].$set.status.$switch.branches.map((branch: { then: OrderStatus }) => branch.then),
        [OrderStatus.PAID, OrderStatus.OVERDUE, OrderStatus.PARTIALLY_PAID],
    );
    assert.equal(capturedUpdate[1].$set.status.$switch.default, OrderStatus.PENDING);
    assert.deepEqual(capturedOptions, { returnDocument: 'after' });
});
