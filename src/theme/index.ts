export { colors } from './colors';
export type { ColorName } from './colors';
export { spacing, radius } from './spacing';
export { typography } from './typography';

import { colors } from './colors';
import type { RiskLevel } from '@/types';

export const riskColor: Record<RiskLevel, string> = {
  bajo: colors.riskLow,
  medio: colors.riskMedium,
  alto: colors.riskHigh,
  muy_alto: colors.riskVeryHigh,
};

export const riskLabel: Record<RiskLevel, string> = {
  bajo: 'Riesgo bajo',
  medio: 'Riesgo medio',
  alto: 'Riesgo alto',
  muy_alto: 'Riesgo muy alto',
};
