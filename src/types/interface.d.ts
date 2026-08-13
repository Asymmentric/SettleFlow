export interface IMetadata {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    summary: IOrderSummary;
}

export interface IOrderSummary {
    totalOrders: number;
    paidOrders: number;
    openOrders: number;
    overdueOrders: number;
}
