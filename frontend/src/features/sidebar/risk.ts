export function getRiskLevel(score: number): 'Moderado' | 'Alto' | 'Muy alto' | 'Extremo' {
  if (score >= 90) return 'Extremo';
  if (score >= 74) return 'Muy alto';
  if (score >= 55) return 'Alto';
  return 'Moderado';
}

