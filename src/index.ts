import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import path from 'path';
import { AppConfig } from './config';
import Database from './config/database/mongo';
import { ErrorHandler } from './utils/errors/errorHandler';
import Logger from './utils/loggers';
import { notFoundHandler, requestLogger } from './utils/middlewares';
import UserRouter from './users/route';
import OrderRouter from './orders/route';
import { startOverdueOrdersCron } from './crons';
import { orderDb } from './container';

const app = express();

app.use(helmet());
app.use(cors());

app.use(['/api', '/health'], requestLogger);
app.use(express.json());

const clientDir = path.join(__dirname, '..', 'client');

app.use(express.static(clientDir));

app.get('/health', (_req, res) => {
    res.status(200).json({ success: true, message: 'OK' });
});

app.use('/api/v1/users', UserRouter);
app.use('/api/v1/orders', OrderRouter);

// The frontend uses clean browser routes. Serve the same application shell for
// each route so refreshing a dashboard or order detail page still works.
app.get(['/', '/dashboard', '/orders/:orderId'], (_req, res) => {
    res.sendFile(path.join(clientDir, 'index.html'));
});

app.use(notFoundHandler);
app.use(ErrorHandler);

const start = async () => {
    try {
        await Database.createConnection();
        Logger.info('Database connection established');
        await Database.init();
        Logger.info('Database initialized');

        try {
            const modifiedCount = await orderDb.markOverdueOrders();
            Logger.info(`Overdue order startup check completed; updated ${modifiedCount} order(s).`);
        } catch (error) {
            Logger.error('Overdue order startup check failed:', error);
        }
        const overdueOrdersCron = startOverdueOrdersCron();
        Logger.info('Overdue order cron scheduled', { schedule: '0 0 * * *' });

        const server = app.listen(AppConfig.port, '0.0.0.0', () => {
            Logger.info(`Server started on port ${AppConfig.port}`);
        });

        const shutdown = (signal: string) => {
            Logger.info(`${signal} received. Shutting down.`);
            overdueOrdersCron.stop();
            server.close(async () => {
                await Database.closeConnection();
                process.exit(0);
            });
        };

        process.on('SIGTERM', () => {
            shutdown('SIGTERM');
        });

        process.on('SIGINT', () => {
            shutdown('SIGINT');
        });
    } catch (error) {
        Logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

void start();

export default app;
