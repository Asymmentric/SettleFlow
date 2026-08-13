export const AppConfig = {
    env: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT || 3000),
    databaseUrl: process.env.DATABASE_URL,
};

export const JwtConfig = {
    secret: process.env.JWT_SECRET as string
};
