import { IsBoolean, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';


const EDGE_TYPES = ['contains', 'depends_on', 'imports', 'owns', 'relates_to'];


export class CreateEdgeDto {

  @IsString()
  @IsNotEmpty()
  fromNodeId!: string;

  @IsString()
  @IsNotEmpty()
  toNodeId!: string;

  @IsIn(EDGE_TYPES)
  edgeType!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @IsOptional()
  @IsBoolean()
  isManual?: boolean;
}
