import moment from "moment";
import { Request, Response, NextFunction } from "express";
import OrderService from "./service";
import AnotherError from "../utils/errors/anotherError";
import { IOrderFilter } from "./types/interface";
import { ObjectId } from "mongodb";
import { once } from "node:events";
import { ORDER_STATUS } from "./types/enum";
import Logger from "../utils/loggers";

export default class OrderController {
    constructor(private readonly orderService: OrderService) { }

    public async createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const orderData = req.body;
            const userId = req?.user?.id;
            if (!userId) {
                throw new AnotherError('User ID is required to create an order.', 401);
            }
            const result = await this.orderService.createOrder({ userId, ...orderData });
            Logger.info('Order created', {
                requestId: req.requestId,
                userId,
                orderId: result._id.toString(),
                lineItemCount: Array.isArray(orderData.lineItems) ? orderData.lineItems.length : 0
            });
            res.status(201).json({ success: true, data: { orderId: result._id } });
        } catch (error) {
            next(error);
        }
    }

    public async getOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req?.user?.id;
            if (!userId) {
                throw new AnotherError('User ID is required to fetch orders.', 401);
            }

            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const sortBy = req.query.sortBy as 'createdAt' | 'dueDate' | 'status' || 'createdAt';
            const filter: IOrderFilter = {
                status: req.query.status as IOrderFilter['status'],
                dueDateFrom: req.query.dueDateFrom as IOrderFilter['dueDateFrom'],
                dueDateTo: req.query.dueDateTo as IOrderFilter['dueDateTo']
            };

            const orders = await this.orderService.getOrdersByUserId({
                userId: new ObjectId(userId),
                page,
                limit,
                sortBy,
                filter
            });
            res.status(200).json({ success: true, metadata: orders.metadata, data: orders.orders });

        } catch (error) {
            next(error);
        }
    }

    public async getOrderById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req?.user?.id;
            const orderId = req.params.orderId as string;

            if (!userId) {
                throw new AnotherError('User ID is required to fetch an order.', 401);
            }

            const order = await this.orderService.getOrderById({
                userId: new ObjectId(userId),
                orderId: new ObjectId(orderId)
            });

            if (!order) {
                throw new AnotherError('Order not found.', 404);
            }

            res.status(200).json({ success: true, data: order });
        } catch (error) {
            next(error);
        }
    }

    public async updateOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req?.user?.id;
            const orderId = req.params.orderId as string;
            const { dueDate } = req.body;

            if (!userId) {
                throw new AnotherError('User ID is required to update an order.', 401);
            }

            const updatedOrder = await this.orderService.updateOrder({
                userId: new ObjectId(userId),
                orderId: new ObjectId(orderId),
                dueDate
            });

            Logger.info('Order due date changed', {
                requestId: req.requestId,
                userId,
                orderId,
                dueDate,
                orderStatus: updatedOrder.status
            });

            res.status(200).json({ success: true, data: updatedOrder });
        } catch (error) {
            next(error);
        }
    }

    public async deleteOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req?.user?.id;
            const orderId = req.params.orderId as string;

            if (!userId) {
                throw new AnotherError('User ID is required to delete an order.', 401);
            }

            const result = await this.orderService.deleteOrder({
                userId: new ObjectId(userId),
                orderId: new ObjectId(orderId)
            });

            if (result.deletedCount === 0) {
                throw new AnotherError('Order not found or not authorized to delete.', 404);
            }

            Logger.info('Order deleted', {
                requestId: req.requestId,
                userId,
                orderId
            });
            res.status(200).json({ success: true, message: 'Order deleted successfully.' });
        } catch (error) {
            next(error);
        }
    }

    public async addLineItem(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req?.user?.id;
            const orderId = req.params.orderId as string;
            const lineItems = req.body.lineItems;

            if (!userId) {
                throw new AnotherError('User ID is required to add line items.', 401);
            }

            if (!orderId) {
                throw new AnotherError('Order ID is required to add line items.', 400);
            }

            const updatedOrder = await this.orderService.addLineItem({
                userId: new ObjectId(userId),
                orderId: new ObjectId(orderId),
                lineItem: lineItems
            });

            Logger.info('Line item added', {
                requestId: req.requestId,
                userId,
                orderId,
                lineItemCount: Array.isArray(lineItems) ? lineItems.length : 0,
                orderTotalMinorUnits: updatedOrder.orderTotal
            });
            res.status(200).json({ success: true, data: updatedOrder });
        } catch (error) {
            next(error);
        }
    }

    public async updateLineItem(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req?.user?.id;
            const orderId = req.params.orderId as string;
            const lineItemId = req.params.lineItemId as string;
            const { description, quantity, unitPrice } = req.body;

            if (!userId) {
                throw new AnotherError('User ID is required to update a line item.', 401);
            }

            const updatedOrder = await this.orderService.updateLineItem({
                userId: new ObjectId(userId),
                orderId: new ObjectId(orderId),
                lineItemId: new ObjectId(lineItemId),
                description,
                quantity,
                unitPrice
            });

            Logger.info('Line item updated', {
                requestId: req.requestId,
                userId,
                orderId,
                lineItemId,
                orderTotalMinorUnits: updatedOrder.orderTotal
            });
            res.status(200).json({ success: true, data: updatedOrder });
        } catch (error) {
            next(error);
        }
    }

    public async deleteLineItem(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req?.user?.id;
            const orderId = req.params.orderId as string;
            const lineItemId = req.params.lineItemId as string;

            if (!userId) {
                throw new AnotherError('User ID is required to delete a line item.', 401);
            }

            const updatedOrder = await this.orderService.deleteLineItem({
                userId: new ObjectId(userId),
                orderId: new ObjectId(orderId),
                lineItemId: new ObjectId(lineItemId)
            });

            Logger.info('Line item deleted', {
                requestId: req.requestId,
                userId,
                orderId,
                lineItemId,
                orderTotalMinorUnits: updatedOrder?.orderTotal
            });
            res.status(200).json({ success: true, data: updatedOrder });
        } catch (error) {
            next(error);
        }
    }

    public async addPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req?.user?.id;
            const orderId = req.params.orderId as string;
            const { amount, note } = req.body;

            if (!userId) {
                throw new AnotherError('User ID is required to add a payment.', 401);
            }

            const updatedOrder = await this.orderService.addPayment({
                userId: new ObjectId(userId),
                orderId: new ObjectId(orderId),
                amount,
                note
            });

            Logger.info('Payment recorded', {
                requestId: req.requestId,
                userId,
                orderId,
                amountMinorUnits: amount,
                paymentsTotalMinorUnits: updatedOrder?.paymentsTotal,
                orderStatus: updatedOrder?.status
            });
            res.status(200).json({ success: true, data: updatedOrder });
        } catch (error) {
            next(error);
        }
    }

    public async exportOrdersToCSV(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req?.user?.id;
            if (!userId) {
                throw new AnotherError('User ID is required to export orders.', 401);
            }

            const filter: IOrderFilter = {
                status: req.query.status as IOrderFilter['status'],
                dueDateFrom: req.query.dueDateFrom as IOrderFilter['dueDateFrom'],
                dueDateTo: req.query.dueDateTo as IOrderFilter['dueDateTo']
            };

            Logger.info('CSV export started', {
                requestId: req.requestId,
                userId,
                status: filter.status,
                dueDateFrom: filter.dueDateFrom,
                dueDateTo: filter.dueDateTo
            });

            const cursor = await this.orderService.exportOrdersToCSV({
                userId: new ObjectId(userId),
                filter
            });

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader(
                "Content-Disposition",
                `attachment; filename="orders.csv"`,
            );

            res.write(
                [
                    "Order ID",
                    "User Name",
                    "User Email",
                    "Due Date",
                    "Status",
                    "Order Total",
                    "Payments Total",
                    "Item ID",
                    "Item Desc",
                    "Item Qty",
                    "Item Unit Price",
                    "Item Total"
                ].join(",") + "\n",
            );

            let exportedOrderCount = 0;
            let exportedLineItemCount = 0;

            try {
                for await (const order of cursor) {
                    exportedOrderCount += 1;
                    const row = [
                        order._id,
                        order.user.name,
                        order.user.email,
                        moment(order.dueDate).format('DD-MMM-YYYY'),
                        ORDER_STATUS[order.status],
                        (order.orderTotal / 100).toFixed(2),
                        (order.paymentsTotal / 100).toFixed(2)
                    ].join(",");

                    if (!res.write(row + "\n")) {
                        await once(res, "drain");
                    }

                    for (const item of order.lineItems) {
                        exportedLineItemCount += 1;
                        const row = [
                            "",
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            item._id,
                            item.description,
                            item.quantity,
                            (item.unitPrice / 100).toFixed(2),
                            (item.subtotal / 100).toFixed(2)
                        ].join(",");

                        if (!res.write(row + "\n")) {
                            await once(res, "drain");
                        }
                    }
                }

                res.end();
                Logger.info('CSV export completed', {
                    requestId: req.requestId,
                    userId,
                    status: filter.status,
                    dueDateFrom: filter.dueDateFrom,
                    dueDateTo: filter.dueDateTo,
                    exportedOrderCount,
                    exportedLineItemCount
                });
            } finally {
                await cursor.close();
            }
        } catch (error) {
            Logger.error('CSV export failed', {
                requestId: req.requestId,
                userId: req.user?.id,
                status: req.query.status,
                dueDateFrom: req.query.dueDateFrom,
                dueDateTo: req.query.dueDateTo
            }, error);
            next(error);
        }
    }

    public async getOrderStatusHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req?.user?.id;
            const orderId = req.params.orderId as string;

            if (!userId) {
                throw new AnotherError('User ID is required to fetch order status history.', 401);
            }

            if (!orderId) {
                throw new AnotherError('Order ID is required to fetch order status history.', 400);
            }

            const statusHistory = await this.orderService.getOrderStatusHistory({
                userId: new ObjectId(userId),
                orderId: new ObjectId(orderId)
            });

            res.status(200).json({ success: true, data: statusHistory });
        } catch (error) {
            next(error);
        }
    }
}
