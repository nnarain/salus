import { deleteEntry, patchEntry } from '@/lib/entryMutation';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  return patchEntry('activities', (await params).id, request);
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  return deleteEntry('activities', (await params).id);
}