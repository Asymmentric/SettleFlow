import { Router } from 'express';
import { controllers } from '../container';
import { authHandler } from '../utils/middlewares';

const OrderRouter = Router();


OrderRouter.use(authHandler);

OrderRouter.post('/', controllers.order.createOrder.bind(controllers.order));
OrderRouter.get('/', controllers.order.getOrders.bind(controllers.order));

OrderRouter.get('/export/csv', controllers.order.exportOrdersToCSV.bind(controllers.order));

OrderRouter.get('/:orderId', controllers.order.getOrderById.bind(controllers.order));
OrderRouter.patch('/:orderId', controllers.order.updateOrder.bind(controllers.order));
OrderRouter.delete('/:orderId', controllers.order.deleteOrder.bind(controllers.order));

OrderRouter.get('/:orderId/status-log', controllers.order.getOrderStatusHistory.bind(controllers.order));

OrderRouter.post('/:orderId/items', controllers.order.addLineItem.bind(controllers.order));
OrderRouter.patch('/:orderId/items/:lineItemId', controllers.order.updateLineItem.bind(controllers.order));
OrderRouter.delete('/:orderId/items/:lineItemId', controllers.order.deleteLineItem.bind(controllers.order));

OrderRouter.post('/:orderId/payments', controllers.order.addPayment.bind(controllers.order));




export default OrderRouter;
