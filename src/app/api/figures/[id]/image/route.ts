import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getFigureStorage } from "@/lib/storage";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth();
  const figure = await prisma.figure.findUnique({ where: { id }, select: { ownerId: true, isPublic: true, imageKey: true, imageMimeType: true } });
  if (!figure || (!figure.isPublic && figure.ownerId !== session?.user?.id)) return new Response("Not found", { status: 404 });
  const bytes = await getFigureStorage().get(figure.imageKey);
  if (!bytes) return new Response("Image unavailable", { status: 404 });
  // Bytes are content-addressed and never change per key, but this URL is keyed
  // by figure id and a figure's visibility can flip to private, so the shared
  // cache must be short-lived and revalidatable rather than immutable.
  const cacheControl = figure.isPublic
    ? "public, max-age=60, s-maxage=300, stale-while-revalidate=3600"
    : "private, no-store";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": figure.imageMimeType,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": cacheControl,
    },
  });
}
