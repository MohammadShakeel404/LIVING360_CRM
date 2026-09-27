import { z } from "zod";
import type { RoleName } from "@prisma/client";

/** Price list is managed by Super Admin / Admin; everyone who builds quotations can use it. */
export const canManageCatalog = (role: RoleName) => role === "SUPER_ADMIN" || role === "ADMIN";

export const CATALOG_UNITS = ["Sq.ft", "R.ft", "Nos", "Set", "Lot", "Lump Sum", "Sq.m", "Kg", "Point"];

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, "Category name is required").max(80),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const itemInputSchema = z.object({
  categoryId: z.string().min(1, "Choose a category"),
  name: z.string().trim().min(1, "Item name is required").max(200),
  description: z.string().trim().max(500).nullable().optional().transform((v) => v || null),
  unit: z.string().trim().min(1).max(20),
  rate: z.number().min(0, "Rate can't be negative"),
  gstPct: z.number().min(0).max(28),
  active: z.boolean().optional(),
});

export type CatalogForEditor = { id: string; name: string; items: { id: string; name: string; description: string | null; unit: string; rate: number; gstPct: number }[] }[];

/** A starter price list for an interior studio — edit rates to match your own. */
export const STARTER_CATALOG: { category: string; items: [name: string, unit: string, rate: number, description?: string][] }[] = [
  { category: "Modular Kitchen", items: [
    ["Base units", "R.ft", 2400, "BWP plywood carcass, laminate finish, soft-close hardware"],
    ["Wall units", "R.ft", 1900, "BWP plywood, laminate shutters"],
    ["Tall unit / pantry", "Nos", 38000],
    ["Quartz countertop", "R.ft", 1800],
    ["Tandem drawers", "Nos", 4500, "Hettich / Hafele tandem box"],
  ] },
  { category: "Wardrobe", items: [
    ["Hinged wardrobe", "Sq.ft", 1650, "BWP ply, laminate outside, liner inside"],
    ["Sliding wardrobe", "Sq.ft", 1950, "Sliding track system, laminate / acrylic shutters"],
    ["Loft unit", "Sq.ft", 1100],
  ] },
  { category: "Living Room", items: [
    ["TV unit with back panel", "Sq.ft", 1850],
    ["Shoe rack", "Nos", 14500],
    ["Crockery unit", "Sq.ft", 1750],
  ] },
  { category: "False Ceiling", items: [
    ["Gypsum false ceiling", "Sq.ft", 110, "Saint-Gobain gypsum board, GI framework"],
    ["Cove lighting provision", "R.ft", 95],
    ["POP cornice", "R.ft", 75],
  ] },
  { category: "Electrical", items: [
    ["New light point", "Point", 850],
    ["LED profile light", "R.ft", 450],
    ["Fan / light shifting", "Point", 600],
  ] },
  { category: "Painting", items: [
    ["Interior emulsion (2 coats + putty)", "Sq.ft", 28],
    ["Texture / accent wall", "Sq.ft", 95],
  ] },
  { category: "Furniture", items: [
    ["Study table with storage", "Nos", 22000],
    ["Bed with hydraulic storage (queen)", "Nos", 42000],
    ["Dressing unit", "Nos", 18000],
  ] },
];
