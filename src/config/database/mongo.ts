import { MongoClient, Db } from 'mongodb';
import Logger from '../../utils/loggers';

export const DB_COLLECTIONS = {
    USERS: 'users',
    ORDERS: 'orders'
}


export default class Database {

    static Instance: Db;
    private static client: MongoClient;

    static async createConnection() {
        const dbConnURL = process.env.DATABASE_URL;
        const dbName = process.env.DB_NAME;

        if (!dbConnURL) {
            throw new Error('DATABASE_URL environment variable is required.');
        }

        Logger.info('Connecting to MongoDB', { database: dbName || 'default' });

        Database.client = new MongoClient(dbConnURL, {
            maxPoolSize: 10
        });

        await Database.client.connect();
        Database.Instance = Database.client.db(dbName);
        Logger.info('MongoDB connection ready', { database: Database.Instance.databaseName });
    }

    static async closeConnection() {
        if (Database.client) {
            Logger.info('Closing MongoDB connection');
            await Database.client.close();
            Logger.info('MongoDB connection closed');
        }
    }

    static async init() {
        if (!Database.Instance) {
            throw new Error('Database connection is not established. Call createConnection() first.');
        }

        Logger.debug('Creating or verifying database indexes');

        await Database.Instance.collection(DB_COLLECTIONS.ORDERS).createIndex({
            userId: 1,
            status: 1,
            createdAt: -1,
            _id: -1
        }, { name: 'orders_userId_status_createdAt_index' });

        await Database.Instance.collection(DB_COLLECTIONS.ORDERS).createIndex(
            { status: 1, dueDate: 1 },
            { name: 'orders_status_due_date' }
        );

        await Database.Instance.collection(DB_COLLECTIONS.ORDERS).createIndex({
            userId: 1,
            dueDate: 1,
            _id: 1,
        }, { name: 'orders_userId_dueDate_index' });

        Logger.debug('Database indexes ready');
    }
}
