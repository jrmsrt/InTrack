/** Coordinator template contents transcribed by the owner on 2026-10-14.
 * Page references are examples from that template, not generated pagination.
 * Reviewers, deadlines, program applicability and recurrence are not supplied.
 */
export interface PortfolioContent {
  id: string;
  group: 'Front matter' | 'Narrative Report' | 'Pre-OJT appendices' | 'During-OJT appendices' | 'Post-OJT appendices';
  title: string;
  templatePage: string;
  sourceLabel?: string;
  existingRequirement?: string;
}
export const portfolioContents: readonly PortfolioContent[] = [
  {id:'title-page',group:'Front matter',title:'Title Page',templatePage:'i'},
  {id:'approval-sheet',group:'Front matter',title:'Approval Sheet',templatePage:'ii'},
  {id:'acknowledgment',group:'Front matter',title:'Acknowledgment',templatePage:'iii'},
  {id:'dedication',group:'Front matter',title:'Dedication',templatePage:'iv'},
  {id:'table-of-contents',group:'Front matter',title:'Table of Contents',templatePage:'v'},
  {id:'introduction',group:'Narrative Report',title:'Introduction',sourceLabel:'I.1',templatePage:'1'},
  {id:'company-profile',group:'Narrative Report',title:'Company Profile',sourceLabel:'I.2',templatePage:'2'},
  {id:'weekly-journal',group:'Narrative Report',title:'Weekly Journal',sourceLabel:'I.3',templatePage:'18',existingRequirement:'Weekly Journal'},
  {id:'self-reflection',group:'Narrative Report',title:'Self-Reflection',sourceLabel:'I.4',templatePage:'30',existingRequirement:'Self-Reflection'},
  {id:'problems-encountered',group:'Narrative Report',title:'Problems Encountered',sourceLabel:'I.5',templatePage:'33'},
  {id:'recommendations',group:'Narrative Report',title:'Recommendations',sourceLabel:'I.6',templatePage:'34'},
  {id:'appendices',group:'Narrative Report',title:'Appendices',sourceLabel:'I.7',templatePage:'35'},
  {id:'endorsement',group:'Pre-OJT appendices',title:'Endorsement/Recommendation Letter',sourceLabel:'A.1',templatePage:'36',existingRequirement:'Endorsement/Recommendation Letter'},
  {id:'registration',group:'Pre-OJT appendices',title:'Registration Card/Form',sourceLabel:'A.1',templatePage:'37',existingRequirement:'Certificate of Registration (COR)'},
  {id:'pre-resume',group:'Pre-OJT appendices',title:'Resume with 2x2 colored picture',sourceLabel:'A.2',templatePage:'38',existingRequirement:'Resume'},
  {id:'parent-consent',group:'Pre-OJT appendices',title:'Notarized Waiver/Parents’ Consent',sourceLabel:'A.3',templatePage:'39',existingRequirement:'Notarized Waiver/Consent Form'},
  {id:'internship-program',group:'Pre-OJT appendices',title:'Notarized Student Internship Program',sourceLabel:'A.4',templatePage:'40',existingRequirement:'Notarized Internship Agreement'},
  {id:'practicum-plan',group:'Pre-OJT appendices',title:'Student Practicum Plan',sourceLabel:'A.5',templatePage:'41',existingRequirement:'Student Practicum Plan'},
  {id:'medical',group:'Pre-OJT appendices',title:'Medical Certificate',sourceLabel:'A.6',templatePage:'42',existingRequirement:'Medical Certificate'},
  {id:'insurance',group:'Pre-OJT appendices',title:'Certificate of Insurance',sourceLabel:'A.8',templatePage:'43',existingRequirement:'Certificate of Insurance'},
  {id:'sis-grades',group:'Pre-OJT appendices',title:'Print Screen of SIS grades (1st year to 3rd year)',sourceLabel:'A.9',templatePage:'44',existingRequirement:'SIS grades (1st year to 3rd year)'},
  {id:'practicum-kit',group:'Pre-OJT appendices',title:'Practicum kit (Expanded Envelope)',sourceLabel:'A.10',templatePage:'45',existingRequirement:'Practicum kit (expanded envelope)'},
  {id:'orientation',group:'Pre-OJT appendices',title:'Certificate (OJT Orientation)',sourceLabel:'A.11',templatePage:'46',existingRequirement:'Certificate (OJT Orientation)'},
  {id:'work-ethics',group:'Pre-OJT appendices',title:'Certificate (Sexual Harassment and Work Ethics)',sourceLabel:'A.12',templatePage:'47',existingRequirement:'Certificate (Sexual Harassment and Work Ethics)'},
  {id:'moa',group:'Pre-OJT appendices',title:'Notarized Memorandum of Agreement',sourceLabel:'A.13',templatePage:'48',existingRequirement:'Notarize Memorandum of Agreement (MOA)'},
  {id:'weekly-pictures',group:'During-OJT appendices',title:'Pictures per week',sourceLabel:'B1',templatePage:'49',existingRequirement:'Pictures / Documentation'},
  {id:'dtr',group:'During-OJT appendices',title:'Daily Time Record',sourceLabel:'B.2',templatePage:'55',existingRequirement:'Daily Time Record'},
  {id:'student-evaluation',group:'Post-OJT appendices',title:'Student Performance Evaluation',sourceLabel:'C.1',templatePage:'56',existingRequirement:'Student Performance Evaluation'},
  {id:'supervisor-evaluation',group:'Post-OJT appendices',title:'HTE Supervisor’s Evaluation',sourceLabel:'C.2',templatePage:'59',existingRequirement:'HTE Supervisor’s Evaluation'},
  {id:'hte-evaluation',group:'Post-OJT appendices',title:'HTE Evaluation',sourceLabel:'C.3',templatePage:'62',existingRequirement:'HTE Evaluation'},
  {id:'completion-certificate',group:'Post-OJT appendices',title:'Certificate of Completion',sourceLabel:'C.4',templatePage:'64',existingRequirement:'Certificate of Completion'},
  {id:'post-resume',group:'Post-OJT appendices',title:'Curriculum Vitae/Resume with picture',sourceLabel:'C.5',templatePage:'65',existingRequirement:'Curriculum Vitae/Resume with picture'},
];

export const addedPostOJTRequirements = ['Curriculum Vitae/Resume with picture'] as const;
export const addedPreOJTRequirements = ['Certificate (OJT Orientation)'] as const;

export function portfolioTemplateTitle(requirementName:string):string | undefined {
  return portfolioContents.find(item => item.existingRequirement === requirementName ||
    (['Weekly Journal','Pictures / Documentation'].includes(item.existingRequirement ?? '') && requirementName.startsWith(`${item.existingRequirement} (Week `)))?.title;
}

/** Append missing items; retain every existing row, custom field and decision. */
export function appendMissingRequirements<T extends {name:string}>(existing:readonly T[], names:readonly string[], create:(name:string)=>T):T[] {
  const result=[...existing];
  const known=new Set(existing.map(item=>item.name));
  for(const name of names)if(!known.has(name)){result.push(create(name));known.add(name);}
  return result;
}
