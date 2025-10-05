"use client";

import { BaseTable } from "./base-table";

export function DataTablePferde({ columns, data }) {
  return <BaseTable columns={columns} data={data} sortable={true} />;
}
