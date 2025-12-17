import { IsInt, IsOptional, Min } from "class-validator";

export class AttachMenuFunctionDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  sequence?: number;
}
