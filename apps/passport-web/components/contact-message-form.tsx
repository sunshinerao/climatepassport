"use client";

import { useState, type FormEvent } from "react";

export function ContactMessageForm({ locale }: { locale: import("@/lib/site-content").Locale }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus("");
    setError("");

    try {
      const response = await fetch("/api/dashboard/messages/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category,
          subject,
          message,
        }),
      });

      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error ?? (locale === "zh" ? "提交失败。" : "Failed to submit message."));
        return;
      }

      setSubject("");
      setMessage("");
      setStatus(locale === "zh" ? "消息已提交，支持团队会尽快处理。" : "Message submitted. Support team will respond soon.");
    } catch {
      setError(locale === "zh" ? "网络异常，请稍后重试。" : "Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <label className="field">
        <span>{locale === "zh" ? "问题类型" : "Category"}</span>
        <select onChange={(event) => setCategory(event.target.value)} value={category}>
          <option value="GENERAL">{locale === "zh" ? "一般咨询" : "General"}</option>
          <option value="PARTNERSHIP">{locale === "zh" ? "合作咨询" : "Partnership"}</option>
          <option value="SPONSOR">{locale === "zh" ? "赞助相关" : "Sponsorship"}</option>
          <option value="MEDIA">{locale === "zh" ? "媒体相关" : "Media"}</option>
        </select>
      </label>
      <label className="field">
        <span>{locale === "zh" ? "主题" : "Subject"}</span>
        <input onChange={(event) => setSubject(event.target.value)} required type="text" value={subject} />
      </label>
      <label className="field">
        <span>{locale === "zh" ? "详细内容" : "Message"}</span>
        <textarea onChange={(event) => setMessage(event.target.value)} required rows={5} value={message} />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      {status ? <p className="form-success">{status}</p> : null}
      <div className="button-row">
        <button className="button" disabled={isSubmitting} type="submit">
          {isSubmitting ? "..." : locale === "zh" ? "提交消息" : "Send message"}
        </button>
      </div>
    </form>
  );
}
