import { deleteEntry, patchEntry } from '@/lib/entryMutation';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  return patchEntry('biometrics', (await params).id, request);
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  return deleteEntry('biometrics', (await params).id);
}