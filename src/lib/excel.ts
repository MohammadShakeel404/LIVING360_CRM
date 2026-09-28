import ExcelJS from "exceljs";

export type ExportColumn<T> = {
  header: string;
  width?: number;
  /** Extracts and formats the cell value for a given row. */
  value: (row: T) => string | number | Date | null | undefined;
  numFmt?: string;
};

const BRAND_PURPLE = "FF523AB7";
const BRAND_GOLD = "FFFEB73F";

/**
 * Builds a single-sheet, brand-styled .xlsx workbook and returns it as a Buffer,
 * ready to be streamed back from an API route.
 */
export async function buildExcelWorkbook<T>(opts: {
  sheetName: string;
  title: string;
  subtitle?: string;
  columns: ExportColumn<T>[];
  rows: T[];
}): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Living 360";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(opts.sheetName, {
    views: [{ state: "frozen", ySplit: opts.subtitle ? 4 : 3 }],
  });

  // Title
  sheet.mergeCells(1, 1, 1, opts.columns.length);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = `Living 360 — ${opts.title}`;
  titleCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_PURPLE } };
  titleCell.alignment = { vertical: "middle" };
  sheet.getRow(1).height = 26;

  let headerRowIndex = 2;
  if (opts.subtitle) {
    sheet.mergeCells(2, 1, 2, opts.columns.length);
    const subCell = sheet.getCell(2, 1);
    subCell.value = opts.subtitle;
    subCell.font = { italic: true, size: 10, color: { argb: "FF6B6480" } };
    headerRowIndex = 3;
  }

  // Blank spacer row
  headerRowIndex += 0;
  const headerRow = sheet.getRow(headerRowIndex + 1);
  opts.columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: "FF251A51" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_GOLD } };
    cell.border = { bottom: { style: "thin", color: { argb: "FFE8E4F2" } } };
    sheet.getColumn(i + 1).width = col.width ?? 20;
  });
  headerRow.height = 20;

  opts.rows.forEach((row) => {
    const dataRow = sheet.addRow(opts.columns.map((col) => col.value(row) ?? ""));
    dataRow.eachCell((cell, colIndex) => {
      const fmt = opts.columns[colIndex - 1]?.numFmt;
      if (fmt) cell.numFmt = fmt;
      cell.border = { bottom: { style: "thin", color: { argb: "FFF0EDF7" } } };
    });
  });

  sheet.autoFilter = {
    from: { row: headerRowIndex + 1, column: 1 },
    to: { row: headerRowIndex + 1, column: opts.columns.length },
  };

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(arrayBuffer);
}

export function excelResponseHeaders(filename: string) {
  return {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="${filename}"`,
  };
}
