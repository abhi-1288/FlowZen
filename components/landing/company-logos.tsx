"use client";

const companies = [
  "Acme Corp",
  "Globex",
  "Initech",
  "Umbrella",
  "Stark Ind",
  "Wayne Ent",
  "Oscorp",
  "Cyberdyne",
  "Soylent",
  "Hooli",
];

export function CompanyLogos() {
  return (
    <section className="py-16 px-6 border-t border-gray-100 dark:border-[#222] relative overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <p className="text-center text-sm font-medium text-gray-400 dark:text-gray-500 mb-10 tracking-wider uppercase">
          Trusted by teams worldwide
        </p>
        <div className="relative overflow-hidden">
          <div className="logo-marquee flex gap-12 items-center">
            {[...companies, ...companies].map((name, i) => (
              <div
                key={i}
                className="shrink-0 flex items-center justify-center h-12 px-6 rounded-lg border border-gray-100 dark:border-[#2a2a2a] bg-white/50 dark:bg-white/[0.02] grayscale opacity-40 dark:opacity-30 hover:grayscale-0 hover:opacity-100 dark:hover:opacity-80 transition-all duration-300 cursor-default"
              >
                <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap select-none">
                  {name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
