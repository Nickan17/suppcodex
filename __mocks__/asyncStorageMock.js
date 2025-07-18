// __mocks__/asyncStorageMock.js
const mockAsyncStorage = (() => {
  let store = {};
  return {
    setItem: (key, value) => Promise.resolve((store[key] = value)),
    getItem: (key) => Promise.resolve(store[key] ?? null),
    removeItem: (key) => Promise.resolve(delete store[key]),
    clear: () => Promise.resolve((store = {})),
    getAllKeys: () => Promise.resolve(Object.keys(store)),
  };
})();
export default mockAsyncStorage;
module.exports = mockAsyncStorage; 