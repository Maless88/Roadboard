export class CreateUserDto {
  username!: string;
  displayName!: string;
  email!: string;
  password!: string;
  role?: string;
  managerId?: string;
}
