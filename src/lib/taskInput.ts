import { z } from "zod";
import { TaskPriority, TaskStatus } from "@prisma/client";

export const taskSchema = z.object({
  title: z.string().trim().min(1, "Give the task a title").max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  projectId: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  priority: z.nativeEnum(TaskPriority).default("MEDIUM"),
  status: z.nativeEnum(TaskStatus).default("TODO"),
  dueDate: z.string().nullable().optional(),
});
