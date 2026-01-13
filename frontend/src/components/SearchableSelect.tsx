import { useState, useMemo, useRef, useEffect } from "react";
import { COLORS } from "../constants/colors";

export interface SearchableSelectProps<T> {
  items: T[];
  onSelect: (item: T) => void;
  searchFields: (keyof T)[];
  renderItem: (item: T, isHighlighted: boolean) => React.ReactNode;
  placeholder?: string;
  emptyMessage?: string;
  maxHeight?: string;
}

/**
 * Reusable searchable dropdown component with keyboard navigation
 * Generic type T allows it to work with any data type (QuestTemplate, Achievement, etc.)
 */
export default function SearchableSelect<T>({
  items,
  onSelect,
  searchFields,
  renderItem,
  placeholder = "Search...",
  emptyMessage = "No items found",
  maxHeight = "400px",
}: SearchableSelectProps<T>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter items based on search term across multiple fields
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;

    const lowerSearch = searchTerm.toLowerCase();
    return items.filter(item => {
      return searchFields.some(field => {
        const value = item[field];
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(lowerSearch);
      });
    });
  }, [items, searchTerm, searchFields]);

  // Reset highlighted index when filtered items change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredItems]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      }
    }
  }, [highlightedIndex]);

  // Auto-focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredItems.length > 0) {
          onSelect(filteredItems[highlightedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setSearchTerm("");
        break;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search Input */}
      <div className="mb-4">
        <input
          ref={searchInputRef}
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full px-3 py-2 font-serif focus:outline-none focus:shadow-lg transition-all"
          style={{
            backgroundColor: COLORS.black,
            borderColor: COLORS.gold,
            borderWidth: "2px",
            color: COLORS.parchment,
          }}
        />
        <div className="mt-2 text-xs font-serif" style={{ color: COLORS.goldDarker }}>
          {filteredItems.length} {filteredItems.length === 1 ? "template" : "templates"} found
        </div>
      </div>

      {/* Results List */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto"
        style={{
          maxHeight,
          borderColor: COLORS.gold,
          borderWidth: "1px",
          backgroundColor: COLORS.black,
        }}
      >
        {filteredItems.length === 0 ? (
          <div
            className="p-4 text-center text-sm font-serif italic"
            style={{ color: COLORS.goldDarker }}
          >
            {emptyMessage}
          </div>
        ) : (
          filteredItems.map((item, index) => (
            <div
              key={index}
              onClick={() => onSelect(item)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className="cursor-pointer transition-all"
              style={{
                backgroundColor:
                  index === highlightedIndex
                    ? `rgba(212, 175, 55, 0.15)`
                    : "transparent",
                borderBottomColor: COLORS.goldDarker,
                borderBottomWidth: index < filteredItems.length - 1 ? "1px" : "0",
              }}
            >
              {renderItem(item, index === highlightedIndex)}
            </div>
          ))
        )}
      </div>

      {/* Keyboard Hints */}
      <div
        className="mt-3 text-xs font-serif text-center"
        style={{ color: COLORS.goldDarker }}
      >
        ↑↓ Navigate • Enter Select • Esc Clear
      </div>
    </div>
  );
}
