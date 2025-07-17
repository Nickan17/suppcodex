const mockPush = jest.fn();
const mockBack = jest.fn();

module.exports = {
  // component code that does `import { router } from "expo-router"`
  router: { push: mockPush, back: mockBack },

  // component code that does `useRouter()`
  useRouter: () => ({ push: mockPush, back: mockBack }),
}; 