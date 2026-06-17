export function Skeleton() {
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="overflow-hidden rounded-xl border border-border">
        <div
          className="flex flex-col gap-6 px-2 py-7"
          style={{
            background:
              "repeating-linear-gradient(0deg, #0c8a3e 0 11.11%, #0a7d38 11.11% 22.22%)",
          }}
        >
          {[1, 4, 4, 2].map((count, row) => (
            <div key={row} className="flex justify-center gap-4">
              {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex w-[68px] flex-col items-center gap-1">
                  <div className="h-11 w-11 animate-pulse rounded-md bg-white/20" />
                  <div className="h-3 w-full animate-pulse rounded bg-white/15" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg border border-border bg-card" />
        ))}
      </div>
      <p className="col-span-full text-center text-sm text-muted-foreground">
        Analyzing your squad and computing recommendations…
      </p>
    </div>
  );
}
