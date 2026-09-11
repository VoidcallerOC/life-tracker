import { deleteHandler, restoreHandler, updateHandler } from "@/lib/api/handlers";

export const dynamic = "force-dynamic";

export const PATCH = updateHandler("task");
export const PUT = restoreHandler("task");
export const DELETE = deleteHandler("task");
