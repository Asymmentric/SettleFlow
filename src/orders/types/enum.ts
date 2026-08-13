export enum OrderStatus {
    PENDING = 'pending',
    PARTIALLY_PAID = 'partially_paid',
    PAID = 'paid',
    OVERDUE = 'overdue'
}

export const ORDER_STATUS = {
    [OrderStatus.PENDING]: 'PENDING',
    [OrderStatus.PARTIALLY_PAID]: 'PARTIALLY PAID',
    [OrderStatus.PAID]: 'PAID',
    [OrderStatus.OVERDUE]: 'OVERDUE'
}