import type { ReactNode } from "react";

type FormFeedbackTone = "error" | "success" | "muted" | "message";

type FormFeedbackProps = {
  children: ReactNode;
  tone?: FormFeedbackTone;
};

function toneClassName(tone: FormFeedbackTone) {
  switch (tone) {
    case "error":
      return "form-error";
    case "success":
      return "form-success";
    case "muted":
      return "cpca-muted";
    case "message":
      return "cpca-message";
    default:
      return "cpca-message";
  }
}

export function FormFeedback({ children, tone = "message" }: FormFeedbackProps) {
  return <p className={toneClassName(tone)}>{children}</p>;
}

export function FormErrorText({ children }: { children: ReactNode }) {
  return <FormFeedback tone="error">{children}</FormFeedback>;
}

export function FormSuccessText({ children }: { children: ReactNode }) {
  return <FormFeedback tone="success">{children}</FormFeedback>;
}

export function FormHelpText({ children }: { children: ReactNode }) {
  return <FormFeedback tone="muted">{children}</FormFeedback>;
}

export function FormMessageText({ children }: { children: ReactNode }) {
  return <FormFeedback tone="message">{children}</FormFeedback>;
}