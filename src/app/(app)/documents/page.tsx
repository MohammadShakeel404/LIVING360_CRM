import { EmptyState } from "@/components/ui";
import { MODULE_META } from "@/lib/moduleMeta";

export default function Page() {
  const m = MODULE_META["documents"];
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold text-ink">{m.title}</h1>
      <div className="rounded-xl2 border border-line bg-white">
        <EmptyState icon={m.icon} title={`${m.title} module`} note={m.note} />
      </div>
    </div>
  );
}
