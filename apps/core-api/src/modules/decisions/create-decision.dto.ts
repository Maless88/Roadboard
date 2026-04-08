export class CreateDecisionDto {
  projectId!: string;
  title!: string;
  summary!: string;
  rationale?: string;
  status?: string;
  impactLevel?: string;
  createdByUserId?: string;
}
