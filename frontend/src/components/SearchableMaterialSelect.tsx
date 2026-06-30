import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Material } from '../types';

interface SearchableMaterialSelectProps {
  materials: Material[];
  value: string;
  onChange: (value: string) => void;
}

const SearchableMaterialSelect: React.FC<SearchableMaterialSelectProps> = ({
  materials,
  value,
  onChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  // Sync filterText with controlled value
  useEffect(() => {
    if (!value) {
      setFilterText('');
      return;
    }
    const matched = materials.find(m => m.material_code === value);
    if (matched) {
      setFilterText(matched.material_code);
    } else {
      setFilterText(value);
    }
  }, [value, materials]);

  // Calculate dropdown position based on input's bounding rect
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

  // Recalculate position on open, scroll, and resize
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

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        inputRef.current && !inputRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
        const matched = materials.find(m => m.material_code === value);
        setFilterText(matched ? matched.material_code : value);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [value, materials]);

  const filtered = materials.filter(m =>
    m.material_code.toLowerCase().includes(filterText.toLowerCase()) ||
    m.description.toLowerCase().includes(filterText.toLowerCase())
  );

  const dropdown = isOpen ? createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: Math.max(dropdownPos.width, 350),
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
        filtered.map(m => (
          <div
            key={m.material_code}
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
              e.preventDefault(); // prevent blur before click fires
              onChange(m.material_code);
              setFilterText(m.material_code);
              setIsOpen(false);
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{m.material_code}</span>
            <span style={{ color: 'var(--text-main)', fontSize: '0.75rem', whiteSpace: 'normal', wordBreak: 'break-word' }}>
              {m.description}
            </span>
          </div>
        ))
      )}
    </div>,
    document.body
  ) : null;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        ref={inputRef}
        type="text"
        className="input-field"
        style={{ width: '100%' }}
        placeholder="Search code or desc..."
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

export default SearchableMaterialSelect;
