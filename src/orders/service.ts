import { AggregationCursor, ObjectId } from "mongodb";
import moment from "moment";
import AnotherError from "../utils/errors/anotherError";
import OrderDB from "./db";

import { IAddLineItem, IAddPayment, IGetOrderById, IGetOrders, ILineItem, IOrder, IOrderCreate, IOrderCreateDB, IOrderFilter, IOrderStatus, IPayment, IUpdateLineItem } from "./types/interface";
import { OrderStatus } from "./types/enum";
import { IMetadata } from "../types/interface";
import PaymentQueue from "../payments/service";
import Logger from "../utils/loggers";

export default class OrderService {
    constructor(private readonly orderDB: OrderDB) { }

    private readonly paymentQueue = new PaymentQueue<IOrder>();

    public async createOrder(order: IOrderCreate): Promise<{ _id: ObjectId }> {
        if (!order.userId || !order.dueDate || !order.lineItems || order.lineItems.length === 0) {
            throw new AnotherError('userId, dueDate, and lineItems are required to create an order.', 400);
        }

        const isValidDate = moment(order.dueDate, moment.ISO_8601, true).isValid();

        if (!isValidDate) {
            throw new AnotherError('Invalid dueDate format.', 400);
        }

        if (moment(order.dueDate).isBefore()) {
            throw new AnotherError('dueDate cannot be in the past.', 400);
        }

        if (order.lineItems.some(item => !item.description || item.quantity <= 0 || item.unitPrice <= 0)) {
            throw new AnotherError('Each line item must have a description, quantity greater than 0, and unitPrice greater than 0.', 400);
        }

        const orderCreationTime = moment().toDate();

        const lineItemsWithSubtotal = order.lineItems.map(item => ({
            _id: new ObjectId(),
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.quantity * item.unitPrice,
            createdAt: orderCreationTime,
            updatedAt: orderCreationTime
        }))
        const orderTotal = order.lineItems.reduce((total, item) => total + (item.quantity * item.unitPrice), 0);

        const statusLog: IOrderStatus = {
            _id: new ObjectId(),
            status: OrderStatus.PENDING,
            createdAt: orderCreationTime,
            updatedAt: orderCreationTime
        }

        const orderWithTotal: IOrderCreateDB = {
            userId: new ObjectId(order.userId),
            dueDate: moment(order.dueDate).toDate(),
            status: OrderStatus.PENDING,
            lineItems: lineItemsWithSubtotal,
            orderTotal,
            statusHistory: [statusLog],
            createdAt: orderCreationTime,
            updatedAt: orderCreationTime
        };

        const { _id: orderId } = await this.orderDB.createOrder(orderWithTotal);

        return { _id: orderId };
    }

    public async getOrdersByUserId(data: IGetOrders): Promise<{ orders: IOrder[], metadata: IMetadata }> {
        if (!data.userId) {
            throw new AnotherError('userId is required to fetch orders.', 400);
        }

        const filter: IOrderFilter = {};

        if (data.filter) {
            if (data.filter.status) {
                filter.status = data.filter.status;
            }

            if (data.filter.dueDateFrom && moment(data.filter.dueDateFrom, moment.ISO_8601, true).isValid()) {
                filter.dueDateFrom = data.filter.dueDateFrom;
            }

            if (data.filter.dueDateTo && moment(data.filter.dueDateTo, moment.ISO_8601, true).isValid()) {
                filter.dueDateTo = data.filter.dueDateTo;
            }
        }

        const getOrdersData: IGetOrders = {
            userId: new ObjectId(data.userId),
            filter,
            page: data.page || 1,
            limit: data.limit || 10,
            sortBy: data.sortBy || 'createdAt'
        }

        const orders = await this.orderDB.getOrdersByUserId(getOrdersData);

        const paginatedOrders = {
            orders: orders.orders,
            metadata: {
                totalCount: orders.totalCount,
                page: getOrdersData.page,
                limit: getOrdersData.limit,
                totalPages: Math.ceil(orders.totalCount / getOrdersData.limit),
                summary: orders.summary
            }
        }

        return paginatedOrders;
    }

    public async getOrderById(data: IGetOrderById): Promise<IOrder | null> {
        if (!data.userId) {
            throw new AnotherError('userId is required to fetch an order.', 400);
        }

        if (!data.orderId) {
            throw new AnotherError('orderId is required to fetch an order.', 400);
        }

        const order = await this.orderDB.getOrderById({
            userId: new ObjectId(data.userId),
            orderId: new ObjectId(data.orderId)
        });

        return order;
    }

    public async updateOrder(data: { orderId: ObjectId, userId: ObjectId, dueDate: Date }): Promise<IOrder> {
        if (!data.userId) {
            throw new AnotherError('userId is required to update an order.', 400);
        }

        if (!data.orderId) {
            throw new AnotherError('orderId is required to update an order.', 400);
        }

        const existingOrder = await this.orderDB.getOrderById({
            userId: new ObjectId(data.userId),
            orderId: new ObjectId(data.orderId)
        });

        if (!existingOrder) {
            throw new AnotherError('Order not found.', 404);
        }

        if (existingOrder.payments.length) {
            throw new AnotherError('Cannot update an order that has already received payments.', 400);
        }

        const isValidDate = moment(data.dueDate, moment.ISO_8601, true).isValid();

        if (!isValidDate) {
            throw new AnotherError('Invalid dueDate format.', 400);
        }

        let orderStatus: OrderStatus = moment(data.dueDate).toDate() < moment().toDate()
            ? OrderStatus.OVERDUE
            : OrderStatus.PENDING;

        const updatedOrder = await this.orderDB.updateOrder({
            orderId: new ObjectId(data.orderId),
            userId: new ObjectId(data.userId),
            dueDate: moment(data.dueDate).toDate(),
            updatedAt: moment().toDate(),
            status: orderStatus !== existingOrder.status ? orderStatus : undefined,
            note: `Order due date updated from ${moment(existingOrder.dueDate).format('YYYY-MM-DD')} to ${moment(data.dueDate).format('YYYY-MM-DD')}.`
        });

        if (!updatedOrder) {
            throw new AnotherError('Failed to update the order.', 500);
        }

        if (updatedOrder.status !== existingOrder.status) {
            Logger.info('Order status changed', {
                userId: data.userId.toString(),
                orderId: data.orderId.toString(),
                previousStatus: existingOrder.status,
                newStatus: updatedOrder.status,
                reason: 'due_date_changed'
            });
        }

        return updatedOrder;
    }

    public async deleteOrder(data: { orderId: ObjectId, userId: ObjectId }): Promise<{ deletedCount: number }> {
        if (!data.userId) {
            throw new AnotherError('userId is required to delete an order.', 400);
        }

        if (!data.orderId) {
            throw new AnotherError('orderId is required to delete an order.', 400);
        }

        const existingOrder = await this.orderDB.getOrderById({
            userId: new ObjectId(data.userId),
            orderId: new ObjectId(data.orderId)
        });

        if (!existingOrder) {
            throw new AnotherError('Order not found.', 404);
        }

        if (existingOrder.payments.length) {
            throw new AnotherError('Cannot delete an order that has already received payments.', 400);
        }

        const result = await this.orderDB.deleteOrder({
            userId: new ObjectId(data.userId),
            orderId: new ObjectId(data.orderId)
        });

        return result;
    }

    public async addLineItem(data: IAddLineItem): Promise<IOrder> {
        if (!data.userId) {
            throw new AnotherError('userId is required to add a line item.', 400);
        }

        if (!data.orderId) {
            throw new AnotherError('orderId is required to add a line item.', 400);
        }

        if (!data.lineItem || data.lineItem.length === 0) {
            throw new AnotherError('lineItem is required to add a line item.', 400);
        }

        if (data.lineItem.some(item => !item.description || item.quantity <= 0 || item.unitPrice <= 0)) {
            throw new AnotherError('Each line item must have a description, quantity greater than 0, and unitPrice greater than 0.', 400);
        }

        const existingOrder = await this.orderDB.getOrderById({
            userId: new ObjectId(data.userId),
            orderId: new ObjectId(data.orderId)
        });

        if (!existingOrder) {
            throw new AnotherError('Order not found.', 404);
        }

        if (existingOrder.payments.length) {
            throw new AnotherError('Cannot add line items to an order that has already received payments.', 400);
        }

        const creationTime = moment().toDate();

        const lineItemsWithSubtotal = data.lineItem.map(item => ({
            _id: new ObjectId(),
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.quantity * item.unitPrice,
            createdAt: creationTime,
            updatedAt: creationTime
        }));

        const updatedOrder = await this.orderDB.addLineItem({
            orderId: new ObjectId(data.orderId),
            userId: new ObjectId(data.userId),
            lineItems: lineItemsWithSubtotal,
            orderTotal: existingOrder.orderTotal + lineItemsWithSubtotal.reduce((total, item) => total + item.subtotal, 0),
            updatedAt: creationTime
        });

        if (!updatedOrder) {
            throw new AnotherError('Failed to add line item to the order.', 500);
        }

        return updatedOrder;
    }

    public async updateLineItem(data: IUpdateLineItem): Promise<IOrder> {
        if (!data.userId) {
            throw new AnotherError('userId is required to update a line item.', 400);
        }

        if (!data.orderId) {
            throw new AnotherError('orderId is required to update a line item.', 400);
        }

        if (!data.lineItemId) {
            throw new AnotherError('lineItemId is required to update a line item.', 400);
        }

        if (!data.description && !data.quantity && !data.unitPrice) {
            throw new AnotherError('At least one of description, quantity, or unitPrice must be provided to update a line item.', 400);
        }

        const existingOrder = await this.orderDB.getOrderById({
            userId: new ObjectId(data.userId),
            orderId: new ObjectId(data.orderId)
        });

        if (!existingOrder) {
            throw new AnotherError('Order not found.', 404);
        }

        if (existingOrder.payments.length) {
            throw new AnotherError('Cannot update line items in an order that has already received payments.', 400);
        }

        const lineItemToUpdate = existingOrder.lineItems.find(item => item._id.equals(data.lineItemId));

        if (!lineItemToUpdate) {
            throw new AnotherError('Line item not found in the order.', 404);
        }

        const lineItemQty = data.quantity ?? lineItemToUpdate.quantity;
        const lineItemPrice = data.unitPrice ?? lineItemToUpdate.unitPrice;
        const updateTime = moment().toDate()

        const lineItemUpdate: ILineItem = {
            _id: lineItemToUpdate._id,
            description: data.description ?? lineItemToUpdate.description,
            quantity: lineItemQty,
            unitPrice: lineItemPrice,
            subtotal: lineItemQty * lineItemPrice,
            createdAt: lineItemToUpdate.createdAt,
            updatedAt: updateTime
        }
        const updatedOrderTotal = existingOrder.orderTotal - lineItemToUpdate.subtotal + lineItemUpdate.subtotal;

        const updatedOrder = await this.orderDB.updateLineItem({
            orderId: new ObjectId(data.orderId),
            userId: new ObjectId(data.userId),
            lineItemId: new ObjectId(data.lineItemId),
            lineItem: lineItemUpdate,
            orderTotal: updatedOrderTotal,
            updatedAt: updateTime
        });
        if (!updatedOrder) {
            throw new AnotherError('Failed to update the line item in the order.', 500);
        }

        return updatedOrder;
    }

    public async deleteLineItem(data: { orderId: ObjectId, userId: ObjectId, lineItemId: ObjectId }): Promise<IOrder | null> {
        if (!data.lineItemId) {
            throw new AnotherError('lineItemId is required to delete a line item.', 400);
        }

        const existingOrder = await this.orderDB.getOrderById({
            userId: new ObjectId(data.userId),
            orderId: new ObjectId(data.orderId)
        });

        if (!existingOrder) {
            throw new AnotherError('Order not found.', 404);
        }

        if (existingOrder.payments.length) {
            throw new AnotherError('Cannot delete line items from an order that has already received payments.', 400);
        }

        const lineItemToDelete = existingOrder.lineItems.find(item => item._id.equals(data.lineItemId));

        if (!lineItemToDelete) {
            throw new AnotherError('Line item not found in the order.', 404);
        }

        const updatedOrderTotal = existingOrder.orderTotal - lineItemToDelete.subtotal;

        const updatedOrder = await this.orderDB.deleteLineItem({
            orderId: new ObjectId(data.orderId),
            userId: new ObjectId(data.userId),
            lineItemId: new ObjectId(data.lineItemId),
            orderTotal: updatedOrderTotal,
            updatedAt: moment().toDate()
        });

        return updatedOrder;
    }

    public async addPayment(data: IAddPayment): Promise<IOrder | null> {
        return this.paymentQueue.enqueue(data.orderId.toString(), () => this.processPayment(data));
    }

    public async processPayment(data: IAddPayment): Promise<IOrder> {
        if (data.amount <= 0) {
            throw new AnotherError('Payment amount must be greater than zero.', 400);
        }

        const existingOrder = await this.orderDB.getOrderById({
            userId: new ObjectId(data.userId),
            orderId: new ObjectId(data.orderId)
        });

        if (!existingOrder) {
            throw new AnotherError('Order not found.', 404);
        }

        const newPaymentsTotal = existingOrder.paymentsTotal + data.amount;

        if (newPaymentsTotal > existingOrder.orderTotal) {
            throw new AnotherError(`Payment exceeds the order total by ${newPaymentsTotal - existingOrder.orderTotal}. Please make a payment for the remaining amount of ${existingOrder.orderTotal - existingOrder.paymentsTotal} only`, 400);
        }

        const paymentDate = moment().toDate();

        const paymentEntry: IPayment = {
            _id: new ObjectId(),
            amount: data.amount,
            date: paymentDate,
            note: data.note || undefined,
            createdAt: paymentDate,
            updatedAt: paymentDate
        };

        const updatedOrder = await this.orderDB.addPayment({
            _id: paymentEntry._id,
            orderId: new ObjectId(data.orderId),
            userId: new ObjectId(data.userId),
            amount: paymentEntry.amount,
            date: paymentEntry.date,
            note: paymentEntry.note,
            createdAt: paymentEntry.createdAt,
            updatedAt: paymentEntry.updatedAt,
        })

        if (!updatedOrder) {
            const latestOrder = await this.orderDB.getOrderById({
                userId: new ObjectId(data.userId),
                orderId: new ObjectId(data.orderId)
            });

            if (latestOrder && latestOrder.paymentsTotal + data.amount > latestOrder.orderTotal) {
                const excess = latestOrder.paymentsTotal + data.amount - latestOrder.orderTotal;
                const remaining = latestOrder.orderTotal - latestOrder.paymentsTotal;
                throw new AnotherError(`Payment exceeds the order total by ${excess}. Please make a payment for the remaining amount of ${remaining} only`, 400);
            }

            throw new AnotherError('Failed to add payment to the order.', 500);
        }

        if (updatedOrder.status !== existingOrder.status) {
            Logger.info('Order status changed', {
                userId: data.userId.toString(),
                orderId: data.orderId.toString(),
                previousStatus: existingOrder.status,
                newStatus: updatedOrder.status,
                reason: 'payment_recorded',
                paymentId: paymentEntry._id.toString()
            });
        }

        return updatedOrder;
    }

    public async exportOrdersToCSV(data: { userId: ObjectId, filter: IOrderFilter }) {
        if (data.filter.dueDateFrom && !moment(data.filter.dueDateFrom, moment.ISO_8601, true).isValid()) {
            throw new AnotherError('Invalid dueDateFrom format.', 400);
        }
        const dateFrom = moment(data.filter.dueDateFrom).startOf('day').toDate();

        if (data.filter.dueDateTo && !moment(data.filter.dueDateTo, moment.ISO_8601, true).isValid()) {
            throw new AnotherError('Invalid dueDateTo format.', 400);
        }
        const dateTo = moment(data.filter.dueDateTo).endOf('day').toDate();

        if (dateFrom && dateTo && dateFrom > dateTo) {
            throw new AnotherError('dueDateFrom cannot be after dueDateTo.', 400);
        }

        const filter: IOrderFilter = {
            status: data.filter.status,
            dueDateFrom: dateFrom,
            dueDateTo: dateTo
        }

        return this.orderDB.exportOrdersToCSV({
            userId: new ObjectId(data.userId),
            filter
        }) as AggregationCursor<IOrder & { user: { name: string, email: string } }>;;


    }

    public async getOrderStatusHistory(data: { userId: ObjectId, orderId: ObjectId }) {
        if (!data.userId) {
            throw new AnotherError('userId is required to fetch order status history.', 400);
        }

        if (!data.orderId) {
            throw new AnotherError('orderId is required to fetch order status history.', 400);
        }

        const existingOrder = await this.orderDB.getOrderById({
            userId: new ObjectId(data.userId),
            orderId: new ObjectId(data.orderId)
        });

        if (!existingOrder) {
            throw new AnotherError('Order not found.', 404);
        }

        const statusHistoryLog = await this.orderDB.getOrderStatusHistory({
            userId: new ObjectId(data.userId),
            orderId: new ObjectId(data.orderId)
        });

        if (!statusHistoryLog) {
            throw new AnotherError('Status history not found for the order.', 404);
        }

        return statusHistoryLog;
    }
}
