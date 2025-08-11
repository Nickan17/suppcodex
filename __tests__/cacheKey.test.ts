import { EXTRACT_SCHEMA_VERSION } from '../src/utils/chainExtractToScore';

test('cache schema version is v4', () => {
  expect(EXTRACT_SCHEMA_VERSION).toBe('v4');
}); 