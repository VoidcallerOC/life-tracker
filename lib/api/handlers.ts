import "server-only";
import { NextResponse } from "next/server";
import type { Animal, Client, Task } from "@/lib/os/types";
import { DatabaseNotConfiguredError, NotFoundError, VersionConflictError } from "@/lib/db/client";
import { UnauthorizedError, requireSession } from "@/lib/session";
import { schemas, type EntityKind } from "@/lib/api/schemas";
import * as repo from "@/lib/db/repository";

type Record_ = Client | Animal | Task;

const operations = {
  client: {
    insert: repo.insertClient,
    update: repo.updateClient,
    remove: repo.softDeleteClient,
    restore: repo.restoreClient,
  },
  animal: {
    insert: repo.insertAnimal,
    update: repo.updateAnimal,
    remove: repo.softDeleteAnimal,
    restore: repo.restoreAnimal,
  },
  task: {
    insert: repo.insertTask,
    update: repo.updateTask,
    remove: repo.softDeleteTask,
    restore: repo.restoreTask,
  },
} as const;

/**
 * Turns thrown domain errors into the status codes the client store knows how
 * to react to. 409 in particular is load-bearing: it is how a device learns its
 * copy of a record is stale instead of overwriting a newer edit.
 */
function errorResponse(error: unknown): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (error instanceof VersionConflictError) {
    return NextResponse.json(
      { error: "conflict", message: "This record changed on another device.", entity: error.entity, id: error.id },
      { status: 409 },
    );
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (error instanceof DatabaseNotConfiguredError) {
    console.error(error);
    return NextResponse.json({ error: "database_not_configured", message: error.message }, { status: 503 });
  }
  console.error("Unhandled API error", error);
  return NextResponse.json({ error: "server_error" }, { status: 500 });
}

async function parseBody(kind: EntityKind, request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = schemas[kind].safeParse(json);
  if (!parsed.success) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "invalid_body", issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })) },
        { status: 422 },
      ),
    };
  }
  return { ok: true as const, data: parsed.data as unknown as Record_ };
}

/** POST /api/<kind>s — create one record. */
export function createHandler(kind: EntityKind) {
  return async function POST(request: Request) {
    try {
      await requireSession();
      const body = await parseBody(kind, request);
      if (!body.ok) return body.response;
      const saved = await (operations[kind].insert as any)(body.data);
      return NextResponse.json(saved, { status: 201 });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/** PATCH /api/<kind>s/[id] — replace one record, guarded by its version. */
export function updateHandler(kind: EntityKind) {
  return async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
      await requireSession();
      const { id } = await context.params;
      const body = await parseBody(kind, request);
      if (!body.ok) return body.response;
      if (body.data.id !== id) {
        return NextResponse.json({ error: "id_mismatch" }, { status: 400 });
      }
      const saved = await (operations[kind].update as any)(body.data, body.data.version);
      return NextResponse.json(saved);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/** DELETE /api/<kind>s/[id]?version=N — soft delete, so undo can restore it. */
export function deleteHandler(kind: EntityKind) {
  return async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
      await requireSession();
      const { id } = await context.params;
      // `Number(null)` is 0, so an absent parameter has to be rejected before
      // parsing — otherwise a missing version reads as a legitimate version 0.
      const raw = new URL(request.url).searchParams.get("version");
      const version = raw === null || raw.trim() === "" ? Number.NaN : Number(raw);
      if (!Number.isInteger(version) || version < 0) {
        return NextResponse.json({ error: "version_required" }, { status: 400 });
      }
      await operations[kind].remove(id, version);
      return new NextResponse(null, { status: 204 });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/** PUT /api/<kind>s/[id] — restore a soft-deleted record (undo). */
export function restoreHandler(kind: EntityKind) {
  return async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
      await requireSession();
      const { id } = await context.params;
      const body = await parseBody(kind, request);
      if (!body.ok) return body.response;
      if (body.data.id !== id) {
        return NextResponse.json({ error: "id_mismatch" }, { status: 400 });
      }
      const saved = await (operations[kind].restore as any)(body.data);
      return NextResponse.json(saved);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export { errorResponse };
