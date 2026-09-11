import { deleteHandler, restoreHandler, updateHandler } from "@/lib/api/handlers";

export const dynamic = "force-dynamic";

export const PATCH = updateHandler("client");
export const PUT = restoreHandler("client");
export const DELETE = deleteHandler("client");
