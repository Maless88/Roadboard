export class CreateTokenDto {
  userId!: string;
  name!: string;
  scope!: string;
  expiresAt?: string;
}
