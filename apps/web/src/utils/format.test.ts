import { describe, it, expect } from 'vitest';
import { formatSize, formatDate } from './format';

describe('formatSize', () => {
  it('should return dash for zero bytes', () => {
    expect(formatSize(0)).toBe('-');
  });

  it('should format bytes', () => {
    expect(formatSize(500)).toBe('500.0 B');
  });

  it('should format kilobytes', () => {
    expect(formatSize(1024)).toBe('1.0 KB');
    expect(formatSize(2048)).toBe('2.0 KB');
  });

  it('should format megabytes', () => {
    expect(formatSize(1048576)).toBe('1.0 MB');
    expect(formatSize(5242880)).toBe('5.0 MB');
  });

  it('should format gigabytes', () => {
    expect(formatSize(1073741824)).toBe('1.0 GB');
  });

  it('should handle fractional values', () => {
    expect(formatSize(1536)).toBe('1.5 KB');
  });
});

describe('formatDate', () => {
  it('should format date string', () => {
    const dateStr = '2024-01-15T10:30:00Z';
    const formatted = formatDate(dateStr);
    // Just check it contains expected parts (locale-dependent)
    expect(formatted).toContain('2024');
    expect(formatted).toContain('Jan');
    expect(formatted).toContain('15');
  });
});
