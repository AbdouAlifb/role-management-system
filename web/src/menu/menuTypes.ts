export type MenuFunction = {
  id: string;
  code: string;
  name: string;
  type: string; // legacy was 1 char (ex: 'M'), you can keep string
  path?: string | null;
  requiredPermissionKey?: string | null;
  sequence?: number | null;
};

export type MenuGroup = {
  id: string;
  code: string;
  name: string;
  icon?: string | null;
  sequence?: number | null;

  // backend can return either:
  functions?: MenuFunction[];

  // or include-style joins:
  menuGroupFunctions?: Array<{
    sequence?: number | null;
    menuFunction: MenuFunction;
  }>;
};
