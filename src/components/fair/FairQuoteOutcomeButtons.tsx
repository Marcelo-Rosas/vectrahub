import { CircleCheck, CircleX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { FairQuoteOutcome } from '@/lib/fair-dashboard-types';

type Props = {
  outcome: FairQuoteOutcome;
  onWon: () => void;
  onLost: () => void;
  disabled?: boolean;
};

export function FairQuoteOutcomeButtons({ outcome, onWon, onLost, disabled }: Props) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <Button
        type="button"
        variant="outline"
        className={cn(
          'min-h-11 touch-manipulation font-semibold',
          outcome === 'won'
            ? 'border-[#16A34A] bg-[#16A34A] text-white hover:bg-[#15803D] hover:text-white'
            : 'border-[#16A34A]/40 text-[#15803D] hover:bg-[#16A34A]/10'
        )}
        disabled={disabled}
        onClick={onWon}
      >
        <CircleCheck className="mr-1.5 h-4 w-4" />
        Ganho
      </Button>
      <Button
        type="button"
        variant="outline"
        className={cn(
          'min-h-11 touch-manipulation font-semibold',
          outcome === 'lost'
            ? 'border-[#DC2626] bg-[#DC2626] text-white hover:bg-[#B91C1C] hover:text-white'
            : 'border-[#DC2626]/40 text-[#B91C1C] hover:bg-[#DC2626]/10'
        )}
        disabled={disabled}
        onClick={onLost}
      >
        <CircleX className="mr-1.5 h-4 w-4" />
        Perdido
      </Button>
    </div>
  );
}
