import { DuelArena } from "@/components/DuelArena";

export default async function DuelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DuelArena pda={id} />;
}
