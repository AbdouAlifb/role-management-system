import { IsArray } from "class-validator";

export class SetRoleGroupsDto {
  @IsArray()
  groupIds: string[];
}
