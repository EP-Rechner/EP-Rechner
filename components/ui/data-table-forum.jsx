"use client";

import { BaseTable } from "./base-table";

export function DataTableForum({ columns, data }) {
  return <BaseTable columns={columns} data={data} sortable={false} />;
}
