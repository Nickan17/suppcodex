import { useTheme as useThemeMode } from '../context/ThemeContext';
import { LIGHT, DARK, spacing, zLayers } from '../components/ui/theme';

export const useTheme = () => {
  const { isDark } = useThemeMode();
  const colors = isDark ? DARK : LIGHT;
  return { colors, spacing, z: zLayers };
}; 