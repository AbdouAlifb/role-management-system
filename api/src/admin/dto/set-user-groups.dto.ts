import { IsArray } from "class-validator";

export class SetUserGroupsDto {
  @IsArray()
  groupIds: string[];
}
