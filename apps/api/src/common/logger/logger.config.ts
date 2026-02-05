import * as winston from 'winston';
import { WinstonModuleOptions } from 'nest-winston';

const { combine, timestamp, json, errors, colorize, printf } = winston.format;

// Custom format for development (human-readable)
const devFormat = printf(({ level, message, timestamp, context, ...meta }) => {
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
  return `${timestamp} [${context || 'App'}] ${level}: ${message} ${metaStr}`;
});

// Production configuration (JSON for log aggregation)
const productionConfig: WinstonModuleOptions = {
  transports: [
    new winston.transports.Console({
      format: combine(
        timestamp(),
        errors({ stack: true }),
        json(),
      ),
    }),
  ],
};

// Development configuration (colorized, human-readable)
const developmentConfig: WinstonModuleOptions = {
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }),
        timestamp({ format: 'HH:mm:ss' }),
        errors({ stack: true }),
        devFormat,
      ),
    }),
  ],
};

export const getLoggerConfig = (): WinstonModuleOptions => {
  const isProduction = process.env.NODE_ENV === 'production';
  return isProduction ? productionConfig : developmentConfig;
};
