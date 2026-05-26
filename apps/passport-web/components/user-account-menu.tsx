"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@prisma/client";
import type { Locale } from "@/lib/site-content";

type MenuUser = {
  name: string;
  email: string;
  avatar: string | null;
  role: UserRole;
};

type MenuItem = {
  href: string;
  icon: string;
  label: string;
};

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "C";
}

function isAdminRole(role: UserRole) {
  return role === "ADMIN" || role === "EVENT_MANAGER";
}

function Avatar({ className = "", user }: { className?: string; user: MenuUser }) {
  const initial = getInitial(user.name);

  return (
    <span
      aria-hidden="true"
      className={`account-avatar ${className}`}
      style={user.avatar ? { backgroundImage: `url(${user.avatar})` } : undefined}
    >
      {user.avatar ? <Image alt="" className="account-avatar-image" height={42} src={user.avatar} width={42} /> : initial}
    </span>
  );
}

function getUserMenuItems(locale: Locale): MenuItem[] {
  const prefix = `/${locale}`;

  return [
    { href: `${prefix}/dashboard`, icon: "ID", label: locale === "zh" ? "账户总览" : "Dashboard" },
    { href: `${prefix}/dashboard/climate-passport`, icon: "CP", label: "Climate Passport" },
    { href: `${prefix}/dashboard/learning-experiences`, icon: "LE", label: locale === "zh" ? "学习项目" : "Learning Experiences" },
    { href: `${prefix}/dashboard/summer-school`, icon: "SS", label: locale === "zh" ? "夏校申请" : "Summer School" },
    { href: `${prefix}/dashboard/messages`, icon: "MS", label: locale === "zh" ? "消息中心" : "Messages" },
    { href: `${prefix}/dashboard/notifications`, icon: "NT", label: locale === "zh" ? "通知设置" : "Notifications" },
    { href: `${prefix}/certificates`, icon: "CT", label: locale === "zh" ? "证书" : "Certificates" },
  ];
}

function getAdminMenuItems(locale: Locale, role: UserRole): MenuItem[] {
  const prefix = `/${locale}`;

  const items: MenuItem[] = [
    { href: `${prefix}/admin`, icon: "AD", label: locale === "zh" ? "管理总览" : "Admin Overview" },
    { href: `${prefix}/admin/events`, icon: "EV", label: locale === "zh" ? "活动管理" : "Event Management" },
    { href: `${prefix}/admin/learning-experiences`, icon: "LE", label: "Learning Experience" },
    { href: `${prefix}/admin/achievements`, icon: "AB", label: locale === "zh" ? "成就与徽章" : "Achievements & Badges" },
    { href: `${prefix}/admin/system`, icon: "SY", label: locale === "zh" ? "系统管理" : "System Settings" },
  ];

  if (role === "ADMIN") {
    items.splice(3, 0, {
      href: `${prefix}/admin/certificates`,
      icon: "CR",
      label: locale === "zh" ? "证书中心" : "Certificate Center",
    });
  }

  return items;
}

export function UserAccountMenu({ locale, user }: { locale: Locale; user: MenuUser }) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const adminUser = isAdminRole(user.role);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace(`/${locale}/auth/login`);
      router.refresh();
    } finally {
      setIsLoggingOut(false);
      setIsOpen(false);
    }
  }

  const userItems = getUserMenuItems(locale);
  const adminItems = adminUser ? getAdminMenuItems(locale, user.role) : [];

  return (
    <div className="account-menu" ref={menuRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="account-menu-trigger"
        onClick={() => setIsOpen((value) => !value)}
        type="button"
      >
        <Avatar user={user} />
        <span className="account-trigger-copy">
          <strong>{user.name}</strong>
          <span>{adminUser ? (locale === "zh" ? "管理员" : "Admin") : (locale === "zh" ? "用户" : "Member")}</span>
        </span>
        <span className="account-menu-chevron" aria-hidden="true">⌄</span>
      </button>

      {isOpen ? (
        <div className="account-menu-panel" role="menu">
          <div className="account-menu-profile">
            <Avatar className="account-avatar-large" user={user} />
            <div>
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
          </div>

          <div className="account-menu-section">
            <span className="account-menu-section-title">{locale === "zh" ? "快捷入口" : "Shortcuts"}</span>
            {userItems.map((item) => (
              <Link className="account-menu-item" href={item.href} key={item.href} onClick={() => setIsOpen(false)} role="menuitem">
                <span className="account-menu-icon" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>

          {adminItems.length > 0 ? (
            <div className="account-menu-section">
              <span className="account-menu-section-title">{locale === "zh" ? "管理入口" : "Admin"}</span>
              {adminItems.map((item) => (
                <Link className="account-menu-item" href={item.href} key={item.href} onClick={() => setIsOpen(false)} role="menuitem">
                  <span className="account-menu-icon" aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          ) : null}

          <div className="account-menu-section account-menu-section-final">
            <button className="account-menu-item account-menu-logout" disabled={isLoggingOut} onClick={handleLogout} role="menuitem" type="button">
              <span className="account-menu-icon" aria-hidden="true">LO</span>
              <span>{isLoggingOut ? (locale === "zh" ? "正在退出..." : "Logging out...") : (locale === "zh" ? "退出登录" : "Log out")}</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
