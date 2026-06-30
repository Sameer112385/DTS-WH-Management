import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Search...',
  style
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  // Sync filterText with value
  useEffect(() => {
    if (!value) {
      setFilterText('');
      return;
    }
    const matched = options.find(o => o.value === value);
    if (matched) {
      setFilterText(matched.label);
    } else {
      setFilterText(value);
    }
  }, [value, options]);

  const updatePosition = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      });
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleScrollOrResize = () => updatePosition();
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        inputRef.current && !inputRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
        const matched = options.find(o => o.value === value);
        setFilterText(matched ? matched.label : value);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [value, options]);

  const filtered = options.filter(o =>
    o.value.toLowerCase().includes(filterText.toLowerCase()) ||
    o.label.toLowerCase().includes(filterText.toLowerCase()) ||
    (o.description && o.description.toLowerCase().includes(filterText.toLowerCase()))
  );

  const dropdown = isOpen ? createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: Math.max(dropdownPos.width, 240),
        maxHeight: '240px',
        overflowY: 'auto',
        zIndex: 9999,
        boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
        borderRadius: 'var(--radius-sm)',
        backgroundColor: '#1e293b',
        border: '1px solid rgba(99, 102, 241, 0.3)'
      }}
    >
      {filtered.length === 0 ? (
        <div style={{ padding: '0.6rem 0.85rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          No matches found
        </div>
      ) : (
        filtered.map(o => (
          <div
            key={o.value}
            style={{
              padding: '0.55rem 0.85rem',
              cursor: 'pointer',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              fontSize: '0.8rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.15rem',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            onMouseDown={(e) => {
              e.preventDefault();
              onChange(o.value);
              setFilterText(o.label);
              setIsOpen(false);
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{o.label}</span>
            {o.description && (
              <span style={{ color: 'var(--text-main)', fontSize: '0.75rem', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                {o.description}
              </span>
            )}
          </div>
        ))
      )}
    </div>,
    document.body
  ) : null;

  return (
    <div style={{ position: 'relative', width: '100%', ...style }}>
      <input
        ref={inputRef}
        type="text"
        className="input-field"
        style={{ width: '100%' }}
        placeholder={placeholder}
        value={filterText}
        onChange={e => {
          setFilterText(e.target.value);
          setIsOpen(true);
          onChange(e.target.value);
        }}
        onFocus={() => {
          updatePosition();
          setIsOpen(true);
        }}
      />
      {dropdown}
    </div>
  );
};

export default SearchableSelect;
