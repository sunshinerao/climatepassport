"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

type CountryComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  preferredOptions?: string[];
  placeholder?: string;
  name?: string;
  id?: string;
  ariaLabel?: string;
  onBlur?: () => void;
  noOptionsText?: string;
};

export function CountryCombobox({
  value,
  onChange,
  options,
  preferredOptions = [],
  placeholder,
  name,
  id,
  ariaLabel,
  onBlur,
  noOptionsText = "No options",
}: CountryComboboxProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const listboxId = `${id ?? name ?? "country"}-options`;

  function uniqueInOrder(items: string[]) {
    return items.filter((item, index) => items.indexOf(item) === index);
  }

  const filteredOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const normalizedValue = value.trim();

    if (query.length > 0) {
      const startsWithMatches = options.filter((option) => option.toLowerCase().startsWith(query));
      const containsMatches = options.filter(
        (option) => option.toLowerCase().includes(query) && !option.toLowerCase().startsWith(query),
      );

      return [...startsWithMatches, ...containsMatches];
    }

    const topCurrent = normalizedValue && options.includes(normalizedValue) ? [normalizedValue] : [];
    const topPreferred = preferredOptions.filter((item) => options.includes(item) && item !== normalizedValue);
    const rest = options.filter((item) => item !== normalizedValue && !topPreferred.includes(item));

    return uniqueInOrder([...topCurrent, ...topPreferred, ...rest]);
  }, [options, preferredOptions, searchQuery, value]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!rootRef.current) {
        return;
      }

      const target = event.target;
      if (target instanceof Node && !rootRef.current.contains(target)) {
        setIsOpen(false);
      }
    }

    window.addEventListener("mousedown", handleOutsideClick);
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery]);

  function commitOption(option: string) {
    onChange(option);
    setIsOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!isOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      setIsOpen(true);
      return;
    }

    if (!isOpen) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, Math.max(filteredOptions.length - 1, 0)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === "Enter" && filteredOptions.length > 0) {
      event.preventDefault();
      commitOption(filteredOptions[highlightedIndex] ?? filteredOptions[0]);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
    }
  }

  return (
    <div className="country-combobox" ref={rootRef}>
      <div className="country-combobox-input-wrap">
        <input
          aria-controls={listboxId}
          aria-expanded={isOpen}
          aria-label={ariaLabel}
          autoComplete="off"
          id={id}
          name={name}
          onBlur={onBlur}
          onChange={(event) => {
            onChange(event.target.value);
            setSearchQuery(event.target.value);
            if (!isOpen) {
              setIsOpen(true);
            }
          }}
          onFocus={() => {
            setSearchQuery("");
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          ref={inputRef}
          role="combobox"
          type="text"
          value={value}
        />
      </div>

      {isOpen ? (
        <div className="country-combobox-list" id={listboxId} role="listbox">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => (
              <button
                aria-selected={highlightedIndex === index}
                className={`country-combobox-option${highlightedIndex === index ? " active" : ""}`}
                key={option}
                onMouseDown={(event) => {
                  event.preventDefault();
                  commitOption(option);
                }}
                role="option"
                type="button"
              >
                {option}
              </button>
            ))
          ) : (
            <div className="country-combobox-empty">{noOptionsText}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
