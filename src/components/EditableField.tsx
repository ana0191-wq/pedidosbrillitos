import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Pencil, Check } from 'lucide-react';
import { parseNum, fmtMoney } from '@/lib/utils';

interface EditableFieldProps {
  label: string;
  value: number | null;
  calculatedValue?: number;
  onSave: (value: number | null) => void;
  format?: (n: number | null) => string;
  highlight?: boolean;
  className?: string;
  suffix?: string;
}

export function EditableField({
  label,
  value,
  calculatedValue,
  onSave,
  format = fmtMoney,
  highlight = false,
  className = '',
  suffix,
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const isOverridden = calculatedValue !== undefined && value != null && Math.abs(value - calculatedValue) > 0.001;

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = () => {
    const num = parseNum(editValue);
    onSave(num);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className={`flex justify-between items-center text-sm ${className}`}>
        <span className="text-muted-foreground">{label}</span>
        <div className="flex items-center gap-1">
          <Input
            ref={inputRef}
            type="number"
            step="0.01"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') setEditing(false);
            }}
            onBlur={handleSave}
            className="h-6 w-24 text-xs text-right"
          />
          <button
            type="button"
            onClick={handleSave}
            className="p-0.5 rounded hover:bg-muted transition-colors"
          >
            <Check className="h-3 w-3 text-green-600" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex justify-between items-center text-sm group cursor-pointer ${className}`}
      onClick={() => {
        setEditValue(value != null ? String(value) : '');
        setEditing(true);
      }}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1">
        <span className={`font-semibold ${highlight ? 'text-green-600 text-base' : 'text-foreground'}`}>
          {format(value)}{suffix ? ` ${suffix}` : ''}
        </span>
        {isOverridden && (
          <span className="text-[9px] bg-primary/10 text-primary px-1 py-0.5 rounded font-medium">📄 Real</span>
        )}
        <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </span>
    </div>
  );
}
