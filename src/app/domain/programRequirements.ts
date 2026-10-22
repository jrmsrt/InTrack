/** Owner-supplied hours and academic labels; unknown mappings remain explicit. */
export const programRequirements = [
  { program: 'BSHM', component: 1, requiredHours: 300, yearLevel: 2, semester: 'summer' },
  { program: 'BSHM', component: 2, requiredHours: 600, yearLevel: 4, semester: '2' },
  { program: 'BSCPE', component: 1, requiredHours: 300, yearLevel: 2, semester: 'summer' },
  { program: 'BSCPE', component: 2, requiredHours: 300, yearLevel: 3, semester: 'summer' },
  { program: 'BSOA', component: 1, requiredHours: 300, yearLevel: 2, semester: '2' },
  { program: 'BSOA', component: 2, requiredHours: 300, yearLevel: 4, semester: '2' },
  { program: 'BSIT', component: 1, requiredHours: 500, yearLevel: 4, semester: '2' },
] as const;

export function requiredMinutesFor(program: string, component: number): number {
  const aliases: Record<string, string> = { it: 'BSIT', bsit: 'BSIT', hm: 'BSHM', bshm: 'BSHM', cpe: 'BSCPE', bscpe: 'BSCPE', oa: 'BSOA', bsoa: 'BSOA' };
  const code = aliases[program.trim().toLowerCase()] || program;
  const item = programRequirements.find(item => item.program === code && item.component === component);
  if (!item) throw new Error('No training requirement configured for this program and component.');
  return item.requiredHours * 60;
}
