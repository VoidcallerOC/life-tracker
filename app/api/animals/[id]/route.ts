import { deleteHandler, restoreHandler, updateHandler } from "@/lib/api/handlers";

export const dynamic = "force-dynamic";

export const PATCH = updateHandler("animal");
export const PUT = restoreHandler("animal");
export const DELETE = deleteHandler("animal");
