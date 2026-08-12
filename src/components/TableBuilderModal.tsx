import { useEffect, useState } from "react";
import Plus from "lucide-react/dist/esm/icons/plus";
import Minus from "lucide-react/dist/esm/icons/minus";
import TableIcon from "lucide-react/dist/esm/icons/table";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import {
  MAX_TABLE_DIMENSION,
  MIN_TABLE_DIMENSION,
  createEmptyTable,
  tableToMarkdown,
  type TableCells,
} from "@/lib/markdownTable";

export type TableBuilderModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the finished, padded Markdown table string. */
  onInsert: (markdown: string) => void;
};

/**
 * A visual, Excel-like grid for building a Markdown table without hand-typing
 * `| Header | Header |` syntax. The first row is always the table header.
 */
export function TableBuilderModal({ isOpen, onClose, onInsert }: TableBuilderModalProps) {
  const [cells, setCells] = useState<TableCells>(() => createEmptyTable());

  // Start fresh every time the modal is opened so a previous table's content
  // doesn't leak into the next one.
  useEffect(() => {
    if (isOpen) setCells(createEmptyTable());
  }, [isOpen]);

  const rowCount = cells.length;
  const colCount = cells[0]?.length ?? 0;

  const updateCell = (rowIndex: number, colIndex: number, text: string) => {
    setCells((prev) =>
      prev.map((row, r) =>
        r === rowIndex ? row.map((cell, c) => (c === colIndex ? text : cell)) : row,
      ),
    );
  };

  const addRow = () => {
    if (rowCount >= MAX_TABLE_DIMENSION) return;
    setCells((prev) => [...prev, Array.from({ length: colCount }, () => "")]);
  };

  const removeRow = () => {
    if (rowCount <= MIN_TABLE_DIMENSION) return;
    setCells((prev) => prev.slice(0, -1));
  };

  const addColumn = () => {
    if (colCount >= MAX_TABLE_DIMENSION) return;
    setCells((prev) => prev.map((row) => [...row, ""]));
  };

  const removeColumn = () => {
    if (colCount <= MIN_TABLE_DIMENSION) return;
    setCells((prev) => prev.map((row) => row.slice(0, -1)));
  };

  const handleInsert = () => {
    const markdown = tableToMarkdown(cells);
    if (!markdown) return;
    onInsert(markdown);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Build a table" className="max-w-3xl">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRow}
            disabled={rowCount >= MAX_TABLE_DIMENSION}
          >
            <Plus size={14} /> Add row
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={removeRow}
            disabled={rowCount <= MIN_TABLE_DIMENSION}
          >
            <Minus size={14} /> Remove row
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addColumn}
            disabled={colCount >= MAX_TABLE_DIMENSION}
          >
            <Plus size={14} /> Add column
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={removeColumn}
            disabled={colCount <= MIN_TABLE_DIMENSION}
          >
            <Minus size={14} /> Remove column
          </Button>
          <span className="ml-auto font-mono text-xs text-gray-500 dark:text-zinc-400">
            {rowCount} × {colCount} (max {MAX_TABLE_DIMENSION} × {MAX_TABLE_DIMENSION})
          </span>
        </div>

        <div className="max-h-[50vh] overflow-auto neu-border">
          <table className="w-full border-collapse">
            <tbody>
              {cells.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((value, colIndex) => (
                    <td
                      key={colIndex}
                      className="border border-black/20 p-0 dark:border-white/20"
                    >
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => updateCell(rowIndex, colIndex, e.target.value)}
                        placeholder={rowIndex === 0 ? `Header ${colIndex + 1}` : ""}
                        aria-label={`Row ${rowIndex + 1}, column ${colIndex + 1}${
                          rowIndex === 0 ? " (header)" : ""
                        }`}
                        className={`w-32 min-w-24 border-none px-2 py-1.5 font-mono text-sm outline-none focus:bg-cream/60 dark:text-white dark:focus:bg-zinc-800 ${
                          rowIndex === 0
                            ? "bg-cream/40 font-bold dark:bg-zinc-800/60"
                            : "bg-white dark:bg-transparent"
                        }`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="flex items-start gap-1.5 font-mono text-xs text-gray-500 dark:text-zinc-400">
          <TableIcon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          The first row becomes the table header. Line breaks inside a cell are converted to
          <code className="mx-1 rounded bg-gray-100 px-1 dark:bg-zinc-800">&lt;br&gt;</code>
          since Markdown tables can&apos;t contain real line breaks.
        </p>

        <div className="flex flex-col-reverse gap-2 border-t-2 border-black pt-4 dark:border-zinc-700 sm:flex-row sm:justify-end sm:space-x-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={handleInsert}>
            Insert table
          </Button>
        </div>
      </div>
    </Modal>
  );
}
