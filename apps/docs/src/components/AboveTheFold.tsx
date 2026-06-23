export function AboveTheFold() {
  return (
    <section className="grid min-h-[75vh] w-full lg:grid-cols-2 relative">
      <div className="flex flex-col justify-end gap-16 border-b border-rp-muted/30 bg-rp-surface p-6 sm:p-8 lg:border-b-0 lg:border-r lg:p-12">
        <h1 className="max-w-3xl text-5xl font-semibold leading-none tracking-[-0.05em] text-rp-text sm:text-7xl lg:text-8xl">Shell scripts, tribal notes, mystery state.</h1>
        <p className="ml-auto text-xs font-medium uppercase tracking-[0.16em] text-rp-subtle">Before</p>
      </div>

      <div className="flex flex-col justify-end gap-16 bg-rp-foam p-6 text-rp-base sm:p-8 lg:p-12">
        <h2 className="max-w-3xl text-5xl font-semibold leading-none tracking-[-0.05em] sm:text-7xl lg:text-8xl">Manifests, facts, typed plans.</h2>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-rp-overlay">After</p>
      </div>
    </section >
  )
}
