import moment from 'moment';
import { ObjectId } from 'mongodb';
import Db, { DB_COLLECTIONS } from '../config/database/mongo';
import { IDeleteLineItem, IGetOrderById, IGetOrders, ILineItem, IOrder, IOrderCreateDB, IOrderFilter, IPaymentDB, IStatusHistoryLog, IUpdateLineItemDB, IUpdateOrderDB } from './types/interface';
import { IOrderSummary } from '../types/interface';
import { OrderStatus } from './types/enum';

export default class OrderDB {

    private get collection() {
        return Db.Instance.collection<IOrder>(DB_COLLECTIONS.ORDERS);
    }

    public async createOrder(order: IOrderCreateDB): Promise<{ _id: ObjectId }> {
        const query = {
            _id: new ObjectId(),
            userId: order.userId,
            dueDate: order.dueDate,
            lineItems: order.lineItems,
            status: order.status,
            payments: [],
            paymentsTotal: 0,
            orderTotal: order.orderTotal,
            statusHistory: order.statusHistory,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt
        }

        const result = await this.collection.insertOne(query);

        return {
            _id: result.insertedId
        }
    }

    public async getOrdersByUserId(data: IGetOrders): Promise<{ orders: IOrder[], totalCount: number, summary: IOrderSummary }> {

        const page = data.page || 1;
        const limit = data.limit || 10;

        const skip = (page - 1) * limit;

        const sortBy = data.sortBy || 'createdAt';
        const filter: IOrderFilter = data.filter || {};
        const query = [
            {
                $match: {
                    userId: new ObjectId(data.userId),
                    ...(filter.status && { status: filter.status }),
                    ...(filter.dueDateFrom && { dueDate: { $gte: filter.dueDateFrom } }),
                    ...(filter.dueDateTo && { dueDate: { $lte: filter.dueDateTo } })
                }
            },
            {
                $sort: {
                    [sortBy]: -1
                }
            },
            {
                $skip: skip
            },
            {
                $limit: limit
            },
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "user"
                }
            },
            {
                $unwind: "$user"
            },
            {
                $unset: "user.password"
            }
        ]

        const countQuery = [
            {
                $match: {
                    userId: new ObjectId(data.userId),
                    ...(filter.status && { status: filter.status }),
                    ...(filter.dueDateFrom && { dueDate: { $gte: filter.dueDateFrom } }),
                    ...(filter.dueDateTo && { dueDate: { $lte: filter.dueDateTo } })
                }
            },
            {
                $count: "totalCount"
            }
        ]

        const summaryQuery = [
            {
                $match: {
                    userId: new ObjectId(data.userId)
                }
            },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    paidOrders: {
                        $sum: { $cond: [{ $eq: ["$status", OrderStatus.PAID] }, 1, 0] }
                    },
                    openOrders: {
                        $sum: {
                            $cond: [
                                { $in: ["$status", [OrderStatus.PENDING, OrderStatus.PARTIALLY_PAID]] },
                                1,
                                0
                            ]
                        }
                    },
                    overdueOrders: {
                        $sum: { $cond: [{ $eq: ["$status", OrderStatus.OVERDUE] }, 1, 0] }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalOrders: 1,
                    paidOrders: 1,
                    openOrders: 1,
                    overdueOrders: 1
                }
            }
        ];

        const [orders, totalCount, summaries] = await Promise.all([
            this.collection.aggregate(query).toArray() as Promise<IOrder[]>,
            this.collection.aggregate(countQuery).toArray() as Promise<{ totalCount: number }[]>,
            this.collection.aggregate<IOrderSummary>(summaryQuery).toArray()
        ]);
        return {
            orders,
            totalCount: totalCount.length > 0 ? totalCount[0].totalCount : 0,
            summary: summaries[0] || {
                totalOrders: 0,
                paidOrders: 0,
                openOrders: 0,
                overdueOrders: 0
            }
        };
    }

    public async getOrderById(data: IGetOrderById): Promise<IOrder | null> {
        const query = [
            {
                $match: {
                    _id: data.orderId,
                    userId: data.userId
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "user"
                }
            },
            {
                $unwind: "$user"
            },
            {
                $unset: "user.password"
            }
        ]

        const orders = await this.collection.aggregate(query).toArray() as IOrder[];
        return orders.length > 0 ? orders[0] : null;
    }

    public async updateOrder(data: IUpdateOrderDB): Promise<IOrder | null> {
        const query = data.status
            ? {
                $set: {
                    dueDate: data.dueDate,
                    status: data.status,
                    updatedAt: data.updatedAt,
                },
                $push: {
                    statusHistory: {
                        _id: new ObjectId(),
                        status: data.status,
                        note: data.note,
                        createdAt: data.updatedAt,
                        updatedAt: data.updatedAt,
                    },
                }
            }
            : {
                $set: {
                    dueDate: data.dueDate,
                    updatedAt: data.updatedAt,
                }
            };

        const order = await this.collection.findOneAndUpdate(
            { _id: new ObjectId(data.orderId), userId: new ObjectId(data.userId), "payments.0": { $exists: false } },
            query,
            { returnDocument: 'after' }
        );

        return order;
    }

    public async deleteOrder(data: { orderId: ObjectId, userId: ObjectId }): Promise<{ deletedCount: number }> {
        const result = await this.collection.deleteOne({ _id: new ObjectId(data.orderId), userId: new ObjectId(data.userId), "payments.0": { $exists: false } });
        return { deletedCount: result.deletedCount };
    }

    public async addLineItem(data: { orderId: ObjectId, userId: ObjectId, lineItems: ILineItem[], orderTotal: number, updatedAt: Date }): Promise<IOrder | null> {
        const query = {
            $push: {
                lineItems: { $each: data.lineItems }
            },
            $set: {
                orderTotal: data.orderTotal,
                updatedAt: data.updatedAt
            }
        };

        const order = await this.collection.findOneAndUpdate(
            { _id: new ObjectId(data.orderId), userId: new ObjectId(data.userId) },
            query,
            { returnDocument: 'after' }
        );

        return order;
    }

    public async updateLineItem(data: IUpdateLineItemDB): Promise<IOrder | null> {
        const query = {
            $set: {
                "lineItems.$.description": data.lineItem.description,
                "lineItems.$.quantity": data.lineItem.quantity,
                "lineItems.$.unitPrice": data.lineItem.unitPrice,
                "lineItems.$.subtotal": data.lineItem.subtotal,
                orderTotal: data.orderTotal,
                updatedAt: data.updatedAt
            }
        };

        const order = await this.collection.findOneAndUpdate(
            { _id: new ObjectId(data.orderId), userId: new ObjectId(data.userId), "lineItems._id": new ObjectId(data.lineItemId) },
            query,
            { returnDocument: 'after' }
        );

        return order;
    }

    public async deleteLineItem(data: IDeleteLineItem): Promise<IOrder | null> {
        const query = {
            $pull: {
                lineItems: { _id: new ObjectId(data.lineItemId) }
            },
            $set: {
                orderTotal: data.orderTotal,
                updatedAt: data.updatedAt
            }
        };

        const order = await this.collection.findOneAndUpdate(
            { _id: new ObjectId(data.orderId), userId: new ObjectId(data.userId) },
            query,
            { returnDocument: 'after' }
        );

        return order;
    }

    public async addPayment(data: IPaymentDB): Promise<IOrder | null> {
        const order = await this.collection.findOneAndUpdate(
            {
                _id: new ObjectId(data.orderId),
                userId: new ObjectId(data.userId),
                $expr: {
                    $lte: [
                        { $add: ["$paymentsTotal", data.amount] },
                        "$orderTotal"
                    ]
                }
            },
            [
                {
                    $set: {
                        payments: {
                            $concatArrays: ["$payments", [{
                                _id: data._id,
                                amount: data.amount,
                                date: data.date,
                                note: data.note,
                                createdAt: data.createdAt,
                                updatedAt: data.updatedAt
                            }]]
                        },
                        paymentsTotal: { $add: ["$paymentsTotal", data.amount] },
                        updatedAt: data.updatedAt,
                    }
                },
                {
                    $set: {
                        status: {
                            $switch: {
                                branches: [
                                    {
                                        case: {
                                            $eq: ["$paymentsTotal", "$orderTotal"]
                                        },
                                        then: OrderStatus.PAID
                                    },
                                    {
                                        case: {
                                            $and: [
                                                {
                                                    $lt: ["$dueDate", data.updatedAt]
                                                },
                                                {
                                                    $lt: ["$paymentsTotal", "$orderTotal"]
                                                }
                                            ]
                                        },
                                        then: OrderStatus.OVERDUE
                                    },
                                    {
                                        case: {
                                            $gt: ["$paymentsTotal", 0]
                                        },
                                        then: OrderStatus.PARTIALLY_PAID
                                    }
                                ],
                                default: OrderStatus.PENDING
                            }
                        }
                    }
                },
                {
                    $set: {
                        statusHistory: {
                            $concatArrays: ["$statusHistory", [{
                                _id: new ObjectId(),
                                status: "$status",
                                note: `Payment of ${(data.amount / 100).toFixed(2)} added.`,
                                paymentId: data._id,
                                createdAt: data.updatedAt,
                                updatedAt: data.updatedAt
                            }]]
                        }
                    }
                }
            ],
            { returnDocument: 'after' }
        );

        return order;
    }

    public exportOrdersToCSV(data: { userId: ObjectId, filter: IOrderFilter }) {
        const dueDateFrom = moment(data.filter.dueDateFrom).startOf('day').toDate();
        const dueDateTo = moment(data.filter.dueDateTo).endOf('day').toDate();
        const statusFilter = data.filter.status ? { status: data.filter.status } : {};

        const query = [
            {
                $match: {
                    userId: new ObjectId(data.userId),
                    dueDate: { $gte: dueDateFrom, $lt: dueDateTo },
                    ...statusFilter
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "user"
                }
            },
            {
                $unwind: "$user"
            },
            {
                $unset: "user.password"
            },
            {
                $sort: {
                    dueDate: 1,
                    _id: 1
                }
            }
        ]

        return this.collection.aggregate(query, { batchSize: 100 })
    }

    public async getOrderStatusHistory(data: { userId: ObjectId, orderId: ObjectId }): Promise<IStatusHistoryLog | null> {
        const query = [
            {
                $match: {
                    userId: new ObjectId(data.userId),
                    _id: new ObjectId(data.orderId)
                },
            },
            {
                $sort: {
                    createdAt: -1,
                },
            },
            {
                $set: {
                    statusHistory: {
                        $map: {
                            input: "$statusHistory",
                            as: "history",
                            in: {
                                $mergeObjects: [
                                    "$$history",
                                    {
                                        payment: {
                                            $arrayElemAt: [
                                                {
                                                    $filter: {
                                                        input: "$payments",
                                                        as: "payment",
                                                        cond: {
                                                            $eq: [
                                                                "$$payment._id",
                                                                "$$history.paymentId",
                                                            ],
                                                        },
                                                    },
                                                },
                                                0,
                                            ],
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
            },
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "user",
                },
            },
            {
                $unwind: {
                    path: "$user",
                },
            },
            {
                $unset: "user.password",
            },
            {
                $project: {
                    _id: 1,
                    user: 1,
                    statusHistory: 1,
                    status: 1,
                    dueDate: 1,
                    createdAt: 1,
                    updatedAt: 1,
                },
            },
        ]

        const result = await this.collection.aggregate(query).toArray() as IStatusHistoryLog[];
        return result.length > 0 ? result[0] : null;
    }

    public async markOverdueOrders(): Promise<number> {
        const nowDate = moment().toDate();
        let modifiedCount = 0;

        const cursor = this.collection.find(
            {
                status: {
                    $in: [
                        OrderStatus.PENDING,
                        OrderStatus.PARTIALLY_PAID,
                    ],
                },
                dueDate: {
                    $lt: nowDate,
                },
            },
            {
                projection: {
                    _id: 1,
                },
            },
        );

        const operations = [];

        for await (const order of cursor) {
            operations.push({
                updateOne: {
                    filter: {
                        _id: order._id,
                        status: {
                            $in: [
                                OrderStatus.PENDING,
                                OrderStatus.PARTIALLY_PAID,
                            ],
                        },
                        dueDate: {
                            $lt: nowDate,
                        },
                    },
                    update: {
                        $set: {
                            status: OrderStatus.OVERDUE,
                            updatedAt: nowDate,
                        },
                        $push: {
                            statusHistory: {
                                _id: new ObjectId(),
                                status: OrderStatus.OVERDUE,
                                note: 'Order automatically marked overdue after due date passed.',
                                createdAt: nowDate,
                                updatedAt: nowDate,
                            },
                        },
                    },
                },
            });

            if (operations.length === 500) {
                const result = await this.collection.bulkWrite(operations);
                modifiedCount += result.modifiedCount;
                operations.length = 0;
            }
        }

        if (operations.length > 0) {
            const result = await this.collection.bulkWrite(operations);
            modifiedCount += result.modifiedCount;
        }

        return modifiedCount;
    }
}
