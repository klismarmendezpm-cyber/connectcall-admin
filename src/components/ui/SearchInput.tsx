import React from 'react';
import { Search, X } from 'lucide-react';
interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}
export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search...',
  className = ''
}) => {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-4 w-4 text-slate-400" />
      </div>
      <input
        type="text"
        className="block w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent sm:text-sm transition-shadow"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)} />
      
      {value &&
      <button
        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
        onClick={() => onChange('')}>
        
          <X className="h-4 w-4" />
        </button>
      }
    </div>);

};