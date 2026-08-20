export function FairEventFooter({ className }: { className?: string }) {
  return (
    <div className={className}>
      <p className="text-center text-sm font-medium text-[#0B1D3A]">
        App para Parceiros Vectra Hub Fitness Brasil 2026
      </p>
      <img
        src="/brand/fitness-brasil-expo.png"
        alt="Fitness Brasil Expo"
        className="mx-auto mt-2 h-12 w-auto max-w-[200px] object-contain sm:h-16"
      />
    </div>
  );
}
