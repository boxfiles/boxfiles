import classNames from "classnames"

export function AboveTheFold() {
  return (
    <section
      className={classNames(
        "relative grid w-full lg:grid-cols-2",
        "min-h-[clamp(48svh,60svh,65svh)]",
      )}
    >
      <div
        className={classNames(
          "flex flex-col justify-end gap-12 sm:gap-14 lg:gap-16",
          "border-b border-rp-muted/30 lg:border-b-0 lg:border-r",
          "bg-rp-surface text-rp-text",
          "p-6 sm:p-8 lg:p-12",
        )}
      >
        <h1
          className={classNames(
            "max-w-3xl font-semibold leading-none tracking-tighter",
            "text-[clamp(1.5rem,8vw,3rem)] xl:text-[clamp(3rem,4vw,6rem)]",
          )}
        >
          Shell scripts, tribal notes, mystery state.
        </h1>
        <p
          className={classNames(
            "ml-auto font-medium uppercase tracking-[0.16em] text-rp-subtle",
            "text-xs",
          )}
        >
          Before
        </p>
      </div>

      <div
        className={classNames(
          "flex flex-col justify-end gap-12 sm:gap-14 lg:gap-16",
          "flex-col-reverse lg:flex-col",
          "bg-rp-foam text-rp-base",
          "p-6 sm:p-8 lg:p-12",
        )}
      >
        <h2
          className={classNames(
            "max-w-3xl font-semibold leading-none tracking-tighter",
            "text-[clamp(1.5rem,8vw,3rem)] xl:text-[clamp(3rem,4vw,6rem)]",
          )}
        >
          Manifests, facts, typed plans.
        </h2>
        <p
          className={classNames(
            "self-end lg:self-auto",
            "font-medium uppercase tracking-[0.16em] text-rp-overlay",
            "text-xs",
          )}
        >
          After
        </p>
      </div>
    </section>
  )
}
