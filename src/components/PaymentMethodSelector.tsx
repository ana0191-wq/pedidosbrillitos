import type { PaymentMethod, PaymentCurrency } from '@/types/orders';

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'PayPal', label: 'PayPal' },
  { value: 'Binance', label: 'Binance' },
  { value: 'PagoMóvil', label: 'PagoMóvil' },
  { value: 'Zelle', label: 'Zelle' },
  { value: 'Efectivo', label: 'Efectivo' },
  { value: 'Otro', label: 'Otro' },
];

const CURRENCIES: { value: PaymentCurrency; label: string }[] = [
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'BS', label: 'Bs' },
];

interface PaymentMethodSelectorProps {
  selected: PaymentMethod | null;
  onSelect: (method: PaymentMethod) => void;
}

export function PaymentMethodSelector({ selected, onSelect }: PaymentMethodSelectorProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PAYMENT_METHODS.map(m => (
        <button
          key={m.value}
          onClick={() => onSelect(m.value)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
            selected === m.value
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

interface CurrencySelectorProps {
  selected: PaymentCurrency | null;
  onSelect: (currency: PaymentCurrency) => void;
}

export function CurrencySelector({ selected, onSelect }: CurrencySelectorProps) {
  return (
    <div className="flex gap-1">
      {CURRENCIES.map(c => (
        <button
          key={c.value}
          onClick={() => onSelect(c.value)}
          className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
            selected === c.value
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
