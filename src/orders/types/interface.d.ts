import { ObjectId } from "mongodb";
import { OrderStatus } from "./enum";


export interface IOrder {
    _id: ObjectId;
    userId: ObjectId;
    dueDate: Date;
    status: OrderStatus;
    lineItems: ILineItem[];
    payments: IPayment[] | [];
    statusHistory: IOrderStatus[] | [];
    orderTotal: number;
    paymentsTotal: number,
    createdAt: Date;
    updatedAt: Date;
}

export interface ILineItem {
    _id: ObjectId;
    description: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface IPayment {
    _id: ObjectId;
    amount: number;
    date: Date;
    note?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface IOrderStatus {
    _id: ObjectId;
    status: 'pending' | 'partially_paid' | 'paid' | 'overdue';
    note?: string;
    paymentId?: ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

export interface IOrderCreate {
    userId: ObjectId;
    dueDate: Date;
    lineItems: Omit<ILineItem, '_id' | 'subtotal'>[];
}

export interface IOrderCreateDB {
    userId: ObjectId;
    dueDate: Date;
    lineItems: ILineItem[];
    orderTotal: number;
    status: OrderStatus;
    statusHistory: IOrderStatus[]
    createdAt: Date;
    updatedAt: Date;
}

export interface IGetOrders {
    userId: ObjectId;
    filter?: IOrderFilter;
    page: number;
    limit: number;
    sortBy: 'createdAt' | 'dueDate' | 'status';
}

export interface IOrderFilter {
    status?: OrderStatus;
    dueDateFrom?: Date;
    dueDateTo?: Date;
}

export interface IGetOrderById { userId: ObjectId, orderId: ObjectId }

export interface IUpdateOrderDB {
    orderId: ObjectId;
    userId: ObjectId;
    dueDate: Date;
    updatedAt: Date;
    status?: OrderStatus;
    note?: string;
}

export interface IAddLineItem {
    userId: ObjectId;
    orderId: ObjectId;
    lineItem: Omit<ILineItem, '_id' | 'subtotal'>[];
}

export interface IUpdateLineItem {
    orderId: ObjectId;
    userId: ObjectId;
    lineItemId: ObjectId;
    description?: string;
    quantity?: number;
    unitPrice?: number;
}

export interface IUpdateLineItemDB {
    orderId: ObjectId,
    userId: ObjectId,
    lineItemId: ObjectId,
    lineItem: ILineItem,
    orderTotal: number,
    updatedAt: Date
}

export interface IDeleteLineItem {
    orderId: ObjectId;
    userId: ObjectId;
    lineItemId: ObjectId;
    orderTotal: number;
    updatedAt: Date;
}

export interface IAddPayment {
    userId: ObjectId;
    orderId: ObjectId;
    amount: number;
    note?: string;
}

export interface IPaymentDB extends IPayment {
    orderId: ObjectId;
    userId: ObjectId;
}

export interface IStatusHistoryLog {
    _id: ObjectId;
    status: OrderStatus;
    dueDate: Date;
    statusHistory: Array<IOrderStatus & { payment: IPayment }>;
    createdAt: Date;
    updatedAt: Date;
    user: { _id: ObjectId, name: string, email: string };
}
