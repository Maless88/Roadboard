export class CreateGrantDto {
  projectId!: string;
  subjectType!: string;
  subjectId!: string;
  grantType!: string;
  grantedByUserId?: string;
}
