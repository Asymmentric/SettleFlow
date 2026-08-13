import cron, { ScheduledTask } from 'node-cron';
import Logger from '../utils/loggers';
import { orderDb } from '../container';

export function startOverdueOrdersCron(): ScheduledTask {
    return cron.schedule(
        '0 0 * * *',
        async () => {
            try {
                const modifiedCount = await orderDb.markOverdueOrders();
                Logger.info('Cron marked orders overdue', {
                    modifiedCount
                });
            } catch (error) {
                Logger.error('Overdue order cron failed', error);
            }
        },
        {
            noOverlap: true,
            name: 'mark-overdue-orders',
            unref: true
        }
    );
}
