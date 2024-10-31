import Hero from "@/app/component/hero";

export default function Home() {
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <h3 className="font-tales uppercase text-3xl">Dead and Injured</h3>
      <Hero />
    </div>
  );
}
