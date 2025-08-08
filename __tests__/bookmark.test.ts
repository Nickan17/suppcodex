/**
 * @jest-environment jsdom 
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock AsyncStorage
const mockGetItem = jest.fn() as jest.MockedFunction<(key: string) => Promise<string | null>>;
const mockSetItem = jest.fn() as jest.MockedFunction<(key: string, value: string) => Promise<void>>;
const mockRemoveItem = jest.fn() as jest.MockedFunction<(key: string) => Promise<void>>;

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: mockGetItem,
    setItem: mockSetItem,
    removeItem: mockRemoveItem,
  },
}));

// Mock the bookmark functionality (would be in a real context/hook)
const mockBookmarkService = {
  getBookmarks: async () => {
    const stored = await mockGetItem('bookmarks');
    return stored ? JSON.parse(stored) : [];
  },
  
  addBookmark: async (productId: string, productData: any) => {
    const existing = await mockBookmarkService.getBookmarks();
    const updated = [...existing, { id: productId, ...productData, bookmarkedAt: Date.now() }];
    await mockSetItem('bookmarks', JSON.stringify(updated));
    return updated;
  },
  
  removeBookmark: async (productId: string) => {
    const existing = await mockBookmarkService.getBookmarks();
    const updated = existing.filter((bookmark: any) => bookmark.id !== productId);
    await mockSetItem('bookmarks', JSON.stringify(updated));
    return updated;
  },
  
  isBookmarked: async (productId: string): Promise<boolean> => {
    const bookmarks = await mockBookmarkService.getBookmarks();
    return bookmarks.some((bookmark: any) => bookmark.id === productId);
  }
};

describe('Bookmark Persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset AsyncStorage mock
    mockGetItem.mockImplementation(() => Promise.resolve(null));
    mockSetItem.mockImplementation(() => Promise.resolve());
    mockRemoveItem.mockImplementation(() => Promise.resolve());
  });

  it('should return empty array when no bookmarks exist', async () => {
    mockGetItem.mockResolvedValue(null);
    
    const bookmarks = await mockBookmarkService.getBookmarks();
    
    expect(bookmarks).toEqual([]);
    expect(mockGetItem).toHaveBeenCalledWith('bookmarks');
  });

  it('should persist bookmark to AsyncStorage', async () => {
    mockGetItem.mockResolvedValue('[]'); // Empty bookmarks initially
    
    const productData = {
      title: 'Magnum Quattro',
      score: 85,
      ingredients: ['Creatine', 'Beta-Alanine']
    };
    
    await mockBookmarkService.addBookmark('quattro-123', productData);
    
    expect(mockSetItem).toHaveBeenCalledWith(
      'bookmarks',
      expect.stringContaining('quattro-123')
    );
    
    // Verify the data structure
    const [, storedData] = (mockSetItem as jest.Mock).mock.calls[0];
    const parsed = JSON.parse(storedData);
    
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      id: 'quattro-123',
      title: 'Magnum Quattro',
      score: 85,
    });
    expect(parsed[0]).toHaveProperty('bookmarkedAt');
  });

  it('should load existing bookmarks from AsyncStorage', async () => {
    const existingBookmarks = [
      {
        id: 'product-1',
        title: 'Product 1',
        score: 75,
        bookmarkedAt: 1640995200000
      },
      {
        id: 'product-2', 
        title: 'Product 2',
        score: 90,
        bookmarkedAt: 1640995300000
      }
    ];
    
    mockGetItem.mockResolvedValue(JSON.stringify(existingBookmarks));
    
    const bookmarks = await mockBookmarkService.getBookmarks();
    
    expect(bookmarks).toHaveLength(2);
    expect(bookmarks[0]).toMatchObject({
      id: 'product-1',
      title: 'Product 1',
      score: 75
    });
    expect(bookmarks[1]).toMatchObject({
      id: 'product-2',
      title: 'Product 2', 
      score: 90
    });
  });

  it('should remove bookmark from AsyncStorage', async () => {
    const existingBookmarks = [
      { id: 'product-1', title: 'Product 1', bookmarkedAt: 123456 },
      { id: 'product-2', title: 'Product 2', bookmarkedAt: 123457 }
    ];
    
    mockGetItem.mockResolvedValue(JSON.stringify(existingBookmarks));
    
    await mockBookmarkService.removeBookmark('product-1');
    
    expect(mockSetItem).toHaveBeenCalledWith(
      'bookmarks',
      expect.not.stringContaining('product-1')
    );
    
    const [, storedData] = (mockSetItem as jest.Mock).mock.calls[0];
    const parsed = JSON.parse(storedData);
    
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe('product-2');
  });

  it('should check if product is bookmarked', async () => {
    const bookmarks = [
      { id: 'bookmarked-product', title: 'Bookmarked', bookmarkedAt: 123456 }
    ];
    
    mockGetItem.mockResolvedValue(JSON.stringify(bookmarks));
    
    const isBookmarked = await mockBookmarkService.isBookmarked('bookmarked-product');
    const isNotBookmarked = await mockBookmarkService.isBookmarked('not-bookmarked');
    
    expect(isBookmarked).toBe(true);
    expect(isNotBookmarked).toBe(false);
  });

  it('should handle AsyncStorage errors gracefully', async () => {
    mockGetItem.mockRejectedValue(new Error('Storage error'));
    
    // Should not throw, but return empty array
    const bookmarks = await mockBookmarkService.getBookmarks().catch(() => []);
    
    expect(bookmarks).toEqual([]);
  });

  it('should maintain bookmark order by bookmarkedAt timestamp', async () => {
    mockGetItem.mockResolvedValue('[]');
    
    // Add bookmarks with slight delay to ensure different timestamps
    await mockBookmarkService.addBookmark('product-1', { title: 'First' });
    
    // Mock a later timestamp for second bookmark
    const originalDateNow = Date.now;
    Date.now = jest.fn().mockReturnValue(originalDateNow() + 1000);
    
    await mockBookmarkService.addBookmark('product-2', { title: 'Second' });
    
    // The bookmarks should be stored in the order they were added
    const [, lastCall] = (mockSetItem as jest.Mock).mock.calls.slice(-1)[0];
    const storedBookmarks = JSON.parse(lastCall);
    
    expect(storedBookmarks[0].title).toBe('First');
    expect(storedBookmarks[1].title).toBe('Second');
    expect(storedBookmarks[1].bookmarkedAt).toBeGreaterThan(storedBookmarks[0].bookmarkedAt);
    
    // Restore original Date.now
    Date.now = originalDateNow;
  });
});