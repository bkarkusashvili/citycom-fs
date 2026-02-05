import { Path } from '../../src/domain/value-objects/Path';

describe('Path', () => {
  describe('create', () => {
    it('should create a valid path', () => {
      const path = Path.create('/home/user/documents');
      expect(path.value).toBe('/home/user/documents');
    });

    it('should normalize empty path to root', () => {
      const path = Path.create('');
      expect(path.value).toBe('/');
    });

    it('should add leading slash if missing', () => {
      const path = Path.create('home/user');
      expect(path.value).toBe('/home/user');
    });

    it('should remove trailing slash', () => {
      const path = Path.create('/home/user/');
      expect(path.value).toBe('/home/user');
    });

    it('should preserve root path', () => {
      const path = Path.create('/');
      expect(path.value).toBe('/');
    });

    it('should remove duplicate slashes', () => {
      const path = Path.create('/home//user///documents');
      expect(path.value).toBe('/home/user/documents');
    });

    it('should resolve . in path', () => {
      const path = Path.create('/home/./user');
      expect(path.value).toBe('/home/user');
    });

    it('should resolve .. in path', () => {
      const path = Path.create('/home/user/../documents');
      expect(path.value).toBe('/home/documents');
    });

    it('should convert backslashes to forward slashes', () => {
      const path = Path.create('\\home\\user');
      expect(path.value).toBe('/home/user');
    });

    it('should throw for path exceeding max length', () => {
      const longPath = '/' + 'a'.repeat(5000);
      expect(() => Path.create(longPath)).toThrow('exceeds maximum length');
    });

    it('should throw for segment exceeding max length', () => {
      const longSegment = 'a'.repeat(300);
      expect(() => Path.create('/' + longSegment)).toThrow('segment exceeds');
    });

    it('should throw for invalid characters', () => {
      expect(() => Path.create('/home/<user>')).toThrow('invalid characters');
    });
  });

  describe('name', () => {
    it('should return the file/folder name', () => {
      const path = Path.create('/home/user/document.txt');
      expect(path.name).toBe('document.txt');
    });

    it('should return / for root', () => {
      const path = Path.create('/');
      expect(path.name).toBe('/');
    });
  });

  describe('parent', () => {
    it('should return parent path', () => {
      const path = Path.create('/home/user/documents');
      expect(path.parent?.value).toBe('/home/user');
    });

    it('should return null for root', () => {
      const path = Path.create('/');
      expect(path.parent).toBeNull();
    });

    it('should return root for top-level path', () => {
      const path = Path.create('/home');
      expect(path.parent?.value).toBe('/');
    });
  });

  describe('segments', () => {
    it('should return path segments', () => {
      const path = Path.create('/home/user/documents');
      expect(path.segments).toEqual(['home', 'user', 'documents']);
    });

    it('should return empty array for root', () => {
      const path = Path.create('/');
      expect(path.segments).toEqual([]);
    });
  });

  describe('depth', () => {
    it('should return correct depth', () => {
      expect(Path.create('/').depth).toBe(0);
      expect(Path.create('/home').depth).toBe(1);
      expect(Path.create('/home/user').depth).toBe(2);
    });
  });

  describe('isRoot', () => {
    it('should return true for root', () => {
      expect(Path.create('/').isRoot()).toBe(true);
    });

    it('should return false for non-root', () => {
      expect(Path.create('/home').isRoot()).toBe(false);
    });
  });

  describe('isChildOf', () => {
    it('should return true for direct child', () => {
      const parent = Path.create('/home');
      const child = Path.create('/home/user');
      expect(child.isChildOf(parent)).toBe(true);
    });

    it('should return false for grandchild', () => {
      const parent = Path.create('/home');
      const grandchild = Path.create('/home/user/documents');
      expect(grandchild.isChildOf(parent)).toBe(false);
    });

    it('should return true for root child', () => {
      const root = Path.create('/');
      const child = Path.create('/home');
      expect(child.isChildOf(root)).toBe(true);
    });
  });

  describe('isDescendantOf', () => {
    it('should return true for direct child', () => {
      const ancestor = Path.create('/home');
      const descendant = Path.create('/home/user');
      expect(descendant.isDescendantOf(ancestor)).toBe(true);
    });

    it('should return true for deep descendant', () => {
      const ancestor = Path.create('/home');
      const descendant = Path.create('/home/user/documents/file.txt');
      expect(descendant.isDescendantOf(ancestor)).toBe(true);
    });

    it('should return false for non-descendant', () => {
      const path1 = Path.create('/home/user');
      const path2 = Path.create('/var/log');
      expect(path2.isDescendantOf(path1)).toBe(false);
    });
  });

  describe('join', () => {
    it('should join segment to path', () => {
      const path = Path.create('/home/user');
      const joined = path.join('documents');
      expect(joined.value).toBe('/home/user/documents');
    });

    it('should join to root', () => {
      const root = Path.create('/');
      const joined = root.join('home');
      expect(joined.value).toBe('/home');
    });
  });

  describe('relativeTo', () => {
    it('should return relative path', () => {
      const base = Path.create('/home/user');
      const full = Path.create('/home/user/documents/file.txt');
      expect(full.relativeTo(base)).toBe('documents/file.txt');
    });

    it('should return . for same path', () => {
      const path = Path.create('/home/user');
      expect(path.relativeTo(path)).toBe('.');
    });

    it('should throw for non-descendant', () => {
      const base = Path.create('/home/user');
      const other = Path.create('/var/log');
      expect(() => other.relativeTo(base)).toThrow('not a descendant');
    });
  });

  describe('equals', () => {
    it('should return true for equal paths', () => {
      const path1 = Path.create('/home/user');
      const path2 = Path.create('/home/user');
      expect(path1.equals(path2)).toBe(true);
    });

    it('should return false for different paths', () => {
      const path1 = Path.create('/home/user');
      const path2 = Path.create('/home/other');
      expect(path1.equals(path2)).toBe(false);
    });
  });
});
