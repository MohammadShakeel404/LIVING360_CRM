/** Skeleton shown while a page's server data loads. */
export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-4" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-48 rounded-lg bg-line" />
      <div className="h-4 w-72 rounded bg-line-soft" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl2 bg-white ring-1 ring-line" />)}
      </div>
      {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-xl2 bg-white ring-1 ring-line" />)}
    </div>
  );
}
