"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import type { Locale } from "@/lib/site-content";

export type PromptRequest = {
  locale: Locale;
  title: string;
  description?: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  multiline?: boolean;
  minLength?: number;
  maxLength?: number;
  confirmLabel?: string;
  cancelLabel?: string;
};

/**
 * Promise-based replacement for window.prompt: resolves with the trimmed value,
 * or null when the operator cancels.
 */
export function usePromptDialog(): [(request: PromptRequest) => Promise<string | null>, ReactNode] {
  const [request, setRequest] = useState<PromptRequest | null>(null);
  const resolver = useRef<((value: string | null) => void) | null>(null);

  const ask = useCallback((next: PromptRequest) => {
    setRequest(next);
    return new Promise<string | null>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((value: string | null) => {
    setRequest(null);
    resolver.current?.(value);
    resolver.current = null;
  }, []);

  return [ask, request ? <PromptDialog key={`${request.title}:${request.label}`} onClose={settle} request={request} /> : null];
}

function PromptDialog({ request, onClose }: { request: PromptRequest; onClose: (value: string | null) => void }) {
  const zh = request.locale === "zh";
  const [value, setValue] = useState(request.defaultValue ?? "");
  const [error, setError] = useState("");
  const fieldRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const field = fieldRef.current;
    field?.focus();
    if (field && request.defaultValue) {
      field.setSelectionRange(field.value.length, field.value.length);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose(null);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose, request.defaultValue]);

  function submit() {
    const trimmed = value.trim();
    const minLength = request.minLength ?? 1;

    if (trimmed.length < minLength) {
      setError(
        minLength > 1
          ? zh
            ? `${request.label}至少需要 ${minLength} 个字符。`
            : `${request.label} needs at least ${minLength} characters.`
          : zh
            ? `${request.label}不能为空。`
            : `${request.label} is required.`,
      );
      return;
    }

    if (request.maxLength && trimmed.length > request.maxLength) {
      setError(
        zh
          ? `${request.label}不能超过 ${request.maxLength} 个字符。`
          : `${request.label} must stay under ${request.maxLength} characters.`,
      );
      return;
    }

    onClose(trimmed);
  }

  const commonProps = {
    "aria-label": request.label,
    className: "cp-prompt-field",
    name: "prompt-value",
    onChange: (event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      setValue(event.target.value);
      setError("");
    },
    placeholder: request.placeholder,
    value,
  };

  return (
    <div className="cp-prompt" onClick={() => onClose(null)} role="presentation">
      <div
        aria-labelledby="cp-prompt-title"
        aria-modal="true"
        className="cp-prompt-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="cp-prompt-head">
          <strong id="cp-prompt-title">{request.title}</strong>
          {request.description ? <small>{request.description}</small> : null}
        </div>
        <div className="cp-prompt-body">
          {request.multiline ? (
            <textarea
              {...commonProps}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) submit();
              }}
              ref={(element) => {
                fieldRef.current = element;
              }}
              rows={5}
            />
          ) : (
            <input
              {...commonProps}
              onKeyDown={(event) => {
                if (event.key === "Enter") submit();
              }}
              ref={(element) => {
                fieldRef.current = element;
              }}
              type="text"
            />
          )}
          {error ? <p className="cp-prompt-error">{error}</p> : null}
          <div className="cp-prompt-actions">
            <button
              className="cp-prompt-button cp-prompt-button-primary"
              onClick={submit}
              type="button"
            >
              {request.confirmLabel ?? (zh ? "确认" : "Confirm")}
            </button>
            <button className="cp-prompt-button" onClick={() => onClose(null)} type="button">
              {request.cancelLabel ?? (zh ? "取消" : "Cancel")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
