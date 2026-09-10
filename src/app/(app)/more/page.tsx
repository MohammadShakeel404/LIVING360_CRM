import Link from "next/link";
import { MODULE_META } from "@/lib/moduleMeta";

export default function MorePage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-bold text-ink">More</h1>
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(MODULE_META).map(([id, m]) => (
          <Link key={id} href={`/${id}`} className="flex flex-col items-center gap-2 rounded-xl2 border border-line bg-white px-2 py-4">
            <m.icon size={20} className="text-primary" />
            <span className="text-center text-xs font-semibold text-ink">{m.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
