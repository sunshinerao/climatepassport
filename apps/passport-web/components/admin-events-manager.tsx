"use client";

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { eventLayerOptions, hostTypeOptions } from "@/lib/event-options";
import type { Locale } from "@/lib/site-content";

type AdminEventRecord = {
  id: string;
  title: string;
  titleEn: string | null;
  description: string;
  descriptionEn: string | null;
  type: string;
  venue: string;
  venueEn: string | null;
  address: string | null;
  addressEn: string | null;
  city: string | null;
  cityEn: string | null;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  requireApproval: boolean;
  isPublished: boolean;
  isClosed: boolean;
  eventLayer: string | null;
  hostType: string | null;
  managerUserId: string | null;
  managerName: string | null;
  registrationCount: number;
};

type ManagerOption = {
  id: string;
  name: string;
  role: UserRole;
};

type EventFormState = {
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  venue: string;
  venueEn: string;
  address: string;
  addressEn: string;
  city: string;
  cityEn: string;
  type: string;
  eventLayer: string;
  hostType: string;
  requireApproval: boolean;
  isPublished: boolean;
  isClosed: boolean;
  managerUserId: string;
};

const defaultState: EventFormState = {
  title: "",
  titleEn: "",
  description: "",
  descriptionEn: "",
  startDate: "",
  endDate: "",
  startTime: "09:00",
  endTime: "17:00",
  venue: "",
  venueEn: "",
  address: "",
  addressEn: "",
  city: "Shanghai",
  cityEn: "Shanghai",
  type: "Forum",
  eventLayer: "COMPREHENSIVE",
  hostType: "OFFICIAL",
  requireApproval: false,
  isPublished: true,
  isClosed: false,
  managerUserId: "",
};

function buildStateFromEvent(event: AdminEventRecord): EventFormState {
  return {
    title: event.title,
    titleEn: event.titleEn ?? "",
    description: event.description,
    descriptionEn: event.descriptionEn ?? "",
    startDate: event.startDate,
    endDate: event.endDate,
    startTime: event.startTime,
    endTime: event.endTime,
    venue: event.venue,
    venueEn: event.venueEn ?? "",
    address: event.address ?? "",
    addressEn: event.addressEn ?? "",
    city: event.city ?? "Shanghai",
    cityEn: event.cityEn ?? "Shanghai",
    type: event.type,
    eventLayer: event.eventLayer ?? "COMPREHENSIVE",
    hostType: event.hostType ?? "OFFICIAL",
    requireApproval: event.requireApproval,
    isPublished: event.isPublished,
    isClosed: event.isClosed,
    managerUserId: event.managerUserId ?? "",
  };
}

export function AdminEventsManager({
  locale,
  userRole,
  initialEvents,
  managers,
}: {
  locale: Locale;
  userRole: UserRole;
  initialEvents: AdminEventRecord[];
  managers: ManagerOption[];
}) {
  const router = useRouter();
  const [events, setEvents] = useState(initialEvents);
  const [selectedId, setSelectedId] = useState<string>("");
  const [formState, setFormState] = useState<EventFormState>({
    ...defaultState,
    managerUserId: userRole === "EVENT_MANAGER" ? managers[0]?.id ?? "" : defaultState.managerUserId,
  });
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = Boolean(selectedId);
  const managerChoices = useMemo(() => {
    if (userRole === "EVENT_MANAGER") {
      return managers.filter((manager) => manager.role === "EVENT_MANAGER");
    }

    return managers;
  }, [managers, userRole]);

  function updateField(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const target = event.target;
    const value = target instanceof HTMLInputElement && target.type === "checkbox" ? target.checked : target.value;

    setFormState((current) => ({
      ...current,
      [target.name]: value,
    }));
  }

  function startCreate() {
    setSelectedId("");
    setError("");
    setStatus("");
    setFormState({
      ...defaultState,
      managerUserId: userRole === "EVENT_MANAGER" ? managers[0]?.id ?? "" : "",
    });
  }

  function startEdit(event: AdminEventRecord) {
    setSelectedId(event.id);
    setError("");
    setStatus("");
    setFormState((current) => ({
      ...current,
      ...buildStateFromEvent(event),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");
    setIsSubmitting(true);

    try {
      const response = await fetch(isEditing ? `/api/admin/events/${selectedId}` : "/api/admin/events", {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formState),
      });

      const result = (await response.json()) as { error?: string; event?: AdminEventRecord };

      if (!response.ok || !result.event) {
        setError(result.error ?? "Unable to save event.");
        return;
      }

      const nextEvents = isEditing
        ? events.map((item) => (item.id === result.event?.id ? result.event : item))
        : [result.event, ...events];

      setEvents(nextEvents);
      setSelectedId(result.event.id);
      setStatus(locale === "zh" ? "已保存活动。" : "Event saved.");
      router.refresh();
    } catch {
      setError(locale === "zh" ? "网络异常，请稍后重试。" : "Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="section two-col admin-layout">
      <div className="panel admin-list-panel">
        <div className="section-header compact-header">
          <div>
            <span className="label">{locale === "zh" ? "活动清单" : "Event inventory"}</span>
            <h2>{locale === "zh" ? "当前可管理活动" : "Current managed events"}</h2>
          </div>
          <button className="button-secondary" onClick={startCreate} type="button">
            {locale === "zh" ? "新建活动" : "New event"}
          </button>
        </div>

        <div className="list admin-list">
          {events.map((eventItem) => (
            <button className="list-item admin-list-item" key={eventItem.id} onClick={() => startEdit(eventItem)} type="button">
              <span className="label">{eventItem.type}</span>
              <strong>{locale === "zh" ? eventItem.title : eventItem.titleEn || eventItem.title}</strong>
              <p>
                {eventItem.startDate} {eventItem.startTime} - {eventItem.endDate} {eventItem.endTime}
              </p>
              <div className="footer-note compact-note">
                {eventItem.managerName || (locale === "zh" ? "未分配负责人" : "No manager assigned")} · {eventItem.registrationCount} {locale === "zh" ? "报名" : "registrations"}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="section-header compact-header">
          <div>
            <span className="label">{isEditing ? (locale === "zh" ? "编辑模式" : "Editing") : locale === "zh" ? "创建模式" : "Create"}</span>
            <h2>{locale === "zh" ? "活动配置" : "Event configuration"}</h2>
          </div>
        </div>

        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="split">
            <label className="field">
              <span>{locale === "zh" ? "中文标题" : "Chinese title"}</span>
              <input name="title" onChange={updateField} required type="text" value={formState.title} />
            </label>
            <label className="field">
              <span>{locale === "zh" ? "英文标题" : "English title"}</span>
              <input name="titleEn" onChange={updateField} type="text" value={formState.titleEn} />
            </label>
          </div>

          <label className="field">
            <span>{locale === "zh" ? "中文描述" : "Chinese description"}</span>
            <textarea name="description" onChange={updateField} required rows={4} value={formState.description} />
          </label>

          <label className="field">
            <span>{locale === "zh" ? "英文描述" : "English description"}</span>
            <textarea name="descriptionEn" onChange={updateField} rows={4} value={formState.descriptionEn} />
          </label>

          <div className="split">
            <label className="field">
              <span>{locale === "zh" ? "开始日期" : "Start date"}</span>
              <input name="startDate" onChange={updateField} required type="date" value={formState.startDate} />
            </label>
            <label className="field">
              <span>{locale === "zh" ? "结束日期" : "End date"}</span>
              <input name="endDate" onChange={updateField} required type="date" value={formState.endDate} />
            </label>
          </div>

          <div className="split">
            <label className="field">
              <span>{locale === "zh" ? "开始时间" : "Start time"}</span>
              <input name="startTime" onChange={updateField} required type="time" value={formState.startTime} />
            </label>
            <label className="field">
              <span>{locale === "zh" ? "结束时间" : "End time"}</span>
              <input name="endTime" onChange={updateField} required type="time" value={formState.endTime} />
            </label>
          </div>

          <div className="split">
            <label className="field">
              <span>{locale === "zh" ? "中文场地" : "Chinese venue"}</span>
              <input name="venue" onChange={updateField} required type="text" value={formState.venue} />
            </label>
            <label className="field">
              <span>{locale === "zh" ? "英文场地" : "English venue"}</span>
              <input name="venueEn" onChange={updateField} type="text" value={formState.venueEn} />
            </label>
          </div>

          <div className="split">
            <label className="field">
              <span>{locale === "zh" ? "地址" : "Address"}</span>
              <input name="address" onChange={updateField} type="text" value={formState.address} />
            </label>
            <label className="field">
              <span>{locale === "zh" ? "地址英文" : "Address in English"}</span>
              <input name="addressEn" onChange={updateField} type="text" value={formState.addressEn} />
            </label>
          </div>

          <div className="split">
            <label className="field">
              <span>{locale === "zh" ? "城市" : "City"}</span>
              <input name="city" onChange={updateField} type="text" value={formState.city} />
            </label>
            <label className="field">
              <span>{locale === "zh" ? "城市英文" : "City in English"}</span>
              <input name="cityEn" onChange={updateField} type="text" value={formState.cityEn} />
            </label>
          </div>

          <div className="split">
            <label className="field">
              <span>{locale === "zh" ? "活动类型" : "Event type"}</span>
              <input name="type" onChange={updateField} required type="text" value={formState.type} />
            </label>
            <label className="field">
              <span>{locale === "zh" ? "负责人" : "Manager"}</span>
              <select disabled={userRole === "EVENT_MANAGER"} name="managerUserId" onChange={updateField} value={formState.managerUserId}>
                <option value="">{locale === "zh" ? "默认当前用户" : "Default to current user"}</option>
                {managerChoices.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.name} ({manager.role})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="split">
            <label className="field">
              <span>{locale === "zh" ? "事件层级" : "Event layer"}</span>
              <select name="eventLayer" onChange={updateField} value={formState.eventLayer}>
                {eventLayerOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{locale === "zh" ? "主办类型" : "Host type"}</span>
              <select name="hostType" onChange={updateField} value={formState.hostType}>
                {hostTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="toggle-grid">
            <label className="toggle-field">
              <input checked={formState.requireApproval} name="requireApproval" onChange={updateField} type="checkbox" />
              <span>{locale === "zh" ? "报名需审批" : "Require approval"}</span>
            </label>
            <label className="toggle-field">
              <input checked={formState.isPublished} name="isPublished" onChange={updateField} type="checkbox" />
              <span>{locale === "zh" ? "立即发布" : "Published"}</span>
            </label>
            <label className="toggle-field">
              <input checked={formState.isClosed} name="isClosed" onChange={updateField} type="checkbox" />
              <span>{locale === "zh" ? "关闭报名" : "Closed"}</span>
            </label>
          </div>

          {error ? <p className="form-error">{error}</p> : null}
          {status ? <p className="form-success">{status}</p> : null}

          <div className="button-row">
            <button className="button" disabled={isSubmitting} type="submit">
              {isSubmitting ? "..." : locale === "zh" ? "保存活动" : "Save event"}
            </button>
            <button className="button-secondary" onClick={startCreate} type="button">
              {locale === "zh" ? "清空表单" : "Reset form"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
