"use client";

import React from "react";
import {
  flexRender,
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
} from "@tanstack/react-table";

export function BaseTable({ columns, data, sortable = true }) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...(sortable && { getSortedRowModel }),
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full border-collapse text-[16px]">
        <thead className="bg-[#34495e] uppercase text-[16px]">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="text-center">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className={`px-6 py-5 font-semibold leading-relaxed ${
                    sortable ? "cursor-pointer hover:text-[#9cc4ff]" : ""
                  }`}
                  style={{ color: "white" }}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>

        <tbody className="divide-y divide-gray-200 text-gray-800">
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="hover:bg-[#f9fafb] transition-colors align-top">
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className="px-6 py-5 text-[15px] leading-relaxed text-gray-900 text-left"
                >
                  {React.isValidElement(cell.getValue())
                    ? cell.getValue()
                    : flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
