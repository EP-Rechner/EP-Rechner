"use client";

import React, { useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

export function DataTable({ columns, data, sortable = true }) {
  const [sorting, setSorting] = useState([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    ...(sortable ? { getSortedRowModel: getSortedRowModel() } : {}),
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white shadow-md">
      <table className="min-w-full border-collapse text-[15px]">
        {/* Tabellenkopf */}
        <thead className="bg-[#34495e] text-white uppercase text-[15px]">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="text-center">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  onClick={
                    sortable ? header.column.getToggleSortingHandler() : undefined
                  }
                  className={`px-6 py-5 font-semibold leading-relaxed ${
                    sortable ? "cursor-pointer hover:text-[#9cc4ff]" : ""
                  }`}
                  style={{ color: "white" }}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {sortable &&
                    (header.column.getIsSorted() === "asc"
                      ? " ▲"
                      : header.column.getIsSorted() === "desc"
                      ? " ▼"
                      : "")}
                </th>
              ))}
            </tr>
          ))}
        </thead>

        {/* Tabelleninhalt */}
        <tbody className="divide-y divide-gray-200 text-gray-800">
          {table.getRowModel().rows.length > 0 ? (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-[#f9fafb] transition-colors align-top"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-6 py-5 text-[15px] leading-relaxed text-gray-900 text-left align-top"
                  >
                    {React.isValidElement(cell.getValue())
                      ? cell.getValue()
                      : flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={columns.length}
                className="px-5 py-6 text-center text-gray-500"
              >
                Keine Daten vorhanden
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
