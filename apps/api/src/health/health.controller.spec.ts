import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import {
  HealthCheckService,
  PrismaHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
  HealthCheckResult,
} from '@nestjs/terminus';
import { PrismaService } from '../infrastructure/prisma.service';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: HealthCheckService;

  const mockPrismaService = {
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  };

  const mockHealthCheckService = {
    check: jest.fn(),
  };

  const mockPrismaHealthIndicator = {
    pingCheck: jest.fn(),
  };

  const mockMemoryHealthIndicator = {
    checkHeap: jest.fn(),
    checkRSS: jest.fn(),
  };

  const mockDiskHealthIndicator = {
    checkStorage: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealthCheckService },
        { provide: PrismaHealthIndicator, useValue: mockPrismaHealthIndicator },
        { provide: MemoryHealthIndicator, useValue: mockMemoryHealthIndicator },
        { provide: DiskHealthIndicator, useValue: mockDiskHealthIndicator },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthCheckService = module.get<HealthCheckService>(HealthCheckService);
  });

  describe('check', () => {
    it('should return basic health status', () => {
      const result = controller.check();

      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
      expect(typeof result.uptime).toBe('number');
    });
  });

  describe('readiness', () => {
    it('should check database connectivity', async () => {
      const healthResult: HealthCheckResult = {
        status: 'ok',
        details: {
          database: { status: 'up' },
        },
      };
      mockHealthCheckService.check.mockResolvedValue(healthResult);

      const result = await controller.readiness();

      expect(result.status).toBe('ok');
      expect(mockHealthCheckService.check).toHaveBeenCalled();
    });
  });

  describe('liveness', () => {
    it('should check memory and disk', async () => {
      const healthResult: HealthCheckResult = {
        status: 'ok',
        details: {
          memory_heap: { status: 'up' },
          memory_rss: { status: 'up' },
          storage: { status: 'up' },
        },
      };
      mockHealthCheckService.check.mockResolvedValue(healthResult);

      const result = await controller.liveness();

      expect(result.status).toBe('ok');
      expect(mockHealthCheckService.check).toHaveBeenCalled();
    });
  });

  describe('detailed', () => {
    it('should check all indicators', async () => {
      const healthResult: HealthCheckResult = {
        status: 'ok',
        details: {
          database: { status: 'up' },
          memory_heap: { status: 'up' },
          memory_rss: { status: 'up' },
          storage: { status: 'up' },
        },
      };
      mockHealthCheckService.check.mockResolvedValue(healthResult);

      const result = await controller.detailed();

      expect(result.status).toBe('ok');
      expect(mockHealthCheckService.check).toHaveBeenCalled();
    });
  });
});
