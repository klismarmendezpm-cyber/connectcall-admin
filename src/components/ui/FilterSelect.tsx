import React from 'react';
interface Option {
  label: string;
  value: string;
}
interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
}
export const FilterSelect: React.FC<FilterSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'All',
  className = ''
}) => {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`block w-full pl-3 pr-10 py-2 text-base border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent sm:text-sm rounded-lg bg-white ${className}`}>
      
      <option value="">{placeholder}</option>
      {options.map((opt) =>
      <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      )}
    </select>);

};