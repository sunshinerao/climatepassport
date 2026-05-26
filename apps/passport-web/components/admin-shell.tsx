"use client";

import type { UserRole } from "@prisma/client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/site-content";

type AdminShellProps = {
  children: ReactNode;
  locale: Locale;
  userRole: UserRole;
};

type AdminNavItem = {
  href: string;
  icon: string;
  label: string;
  match?: string;
  roles?: UserRole[];
  children?: AdminNavItem[];
};

function t(locale: Locale, zh: string, en: string) {
  return locale === "zh" ? zh : en;
}

function canSeeItem(item: AdminNavItem, role: UserRole) {
  return !item.roles || item.roles.includes(role);
}

function isActivePath(pathname: string, item: AdminNavItem) {
  const matchPath = item.match ?? item.href;

  if (pathname === item.href) {
    return true;
  }

  if (item.href.endsWith("/admin")) {
    return false;
  }

  if (item.href !== matchPath && pathname.startsWith(`${item.href}/`)) {
    return true;
  }

  return pathname === matchPath || pathname.startsWith(`${matchPath}/`);
}

function buildAdminMenu(locale: Locale): AdminNavItem[] {
  const prefix = `/${locale}`;

  return [
    {
      href: `${prefix}/admin`,
      icon: "◉",
      label: t(locale, "控制台总览", "Dashboard overview"),
    },
    {
      href: `${prefix}/admin/events`,
      icon: "◇",
      label: t(locale, "活动管理", "Event management"),
      children: [
        {
          href: `${prefix}/admin/events`,
          icon: "·",
          label: t(locale, "活动列表与编辑", "Event list and editor"),
        },
      ],
    },
    {
      href: `${prefix}/admin/learning-experiences`,
      icon: "◇",
      label: "Learning Experiences",
      children: [
        {
          href: `${prefix}/admin/learning-experiences`,
          icon: "·",
          label: t(locale, "项目总览 / 项目管理", "Program overview"),
        },
        {
          href: `${prefix}/admin/learning-experiences/applications`,
          icon: "·",
          label: t(locale, "申请管理", "Application management"),
        },
        {
          href: `${prefix}/admin/summer-school/applications`,
          icon: "·",
          label: t(locale, "*夏校申请列表", "Summer School applications list"),
          roles: ["ADMIN"],
        },
      ],
    },
    {
      href: `${prefix}/admin/certificates`,
      icon: "◇",
      label: t(locale, "证书中心", "Certificate Hub"),
      roles: ["ADMIN"],
      children: [
        {
          href: `${prefix}/admin/certificates`,
          icon: "·",
          label: t(locale, "证书总览", "Certificate overview"),
        },
        {
          href: `${prefix}/admin/certificates/records`,
          icon: "·",
          label: t(locale, "证书记录", "Certificate records"),
        },
        {
          href: `${prefix}/admin/certificates/issue`,
          icon: "·",
          label: t(locale, "签发证书", "Issue certificates"),
        },
        {
          href: `${prefix}/admin/certificates/applications`,
          icon: "·",
          label: t(locale, "申请审核", "Application review"),
        },
        {
          href: `${prefix}/admin/certificates/categories`,
          icon: "·",
          label: t(locale, "分类管理", "Category management"),
        },
        {
          href: `${prefix}/admin/certificates/templates`,
          icon: "·",
          label: t(locale, "模板管理", "Template management"),
        },
        {
          href: `${prefix}/admin/certificates/rules`,
          icon: "·",
          label: t(locale, "自动签发规则", "Issuing rules"),
        },
        {
          href: `${prefix}/admin/certificates/audit-logs`,
          icon: "·",
          label: t(locale, "验证与审计日志", "Verification and audit logs"),
        },
      ],
    },
    {
      href: `${prefix}/admin/achievements`,
      icon: "◇",
      label: t(locale, "成就与徽章", "Achievements & Badges"),
      roles: ["ADMIN"],
      children: [
        {
          href: `${prefix}/admin/achievements`,
          icon: "·",
          label: t(locale, "成就审核", "Achievement review"),
        },
        {
          href: `${prefix}/admin/badges/definitions`,
          icon: "·",
          label: t(locale, "徽章定义", "Badge definitions"),
        },
        {
          href: `${prefix}/admin/badges/awards`,
          icon: "·",
          label: t(locale, "徽章授予", "Badge awards"),
        },
      ],
    },
    {
      href: "",
      icon: "◇",
      label: t(locale, "系统与运营", "System and operations"),
      roles: ["ADMIN"],
    },
    {
      href: `${prefix}/verifier`,
      icon: "◇",
      label: t(locale, "扫码与签到", "Verifier console"),
      roles: ["ADMIN", "EVENT_MANAGER"],
    },
    {
      href: `${prefix}/dashboard`,
      icon: "◇",
      label: t(locale, "返回用户工作台", "Return workspace"),
    },
  ];
}

export function AdminShell({ children, locale, userRole }: AdminShellProps) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menu = buildAdminMenu(locale).filter((item) => canSeeItem(item, userRole));

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  return (
    <div className="proto-admin-page">
      <div className="proto-admin-mobilebar">
        <button
          aria-controls="admin-sidebar"
          aria-expanded={isMenuOpen}
          aria-label={t(locale, "打开管理菜单", "Open admin menu")}
          className="proto-admin-menu-button"
          onClick={() => setIsMenuOpen((value) => !value)}
          type="button"
        >
          <span />
          <span />
          <span />
        </button>
        <strong>Admin Workspace</strong>
      </div>
      <button
        aria-label={t(locale, "关闭管理菜单", "Close admin menu")}
        className={`proto-admin-overlay ${isMenuOpen ? "is-open" : ""}`}
        onClick={() => setIsMenuOpen(false)}
        type="button"
      />
      <section className={`proto-admin-shell ${isMenuOpen ? "is-menu-open" : ""}`}>
        <aside className="proto-admin-sidebar" id="admin-sidebar">
          <div className="proto-admin-sidebar-head">
            <span>{t(locale, "管理控制台", "Operations Console")}</span>
            <h1>Admin Workspace</h1>
            <p>
              {t(
                locale,
                "后台采用真实角色门禁。一级菜单按模块组织，模块内部功能作为二级菜单展开。",
                "Live role gates are enforced. Primary navigation is module-level, with secondary menus inside each module.",
              )}
            </p>
          </div>

          <nav className="proto-admin-nav" aria-label="Admin navigation">
            <span className="proto-admin-nav-section">{t(locale, "运营", "Operate")}</span>
            {menu.map((item, index) => {
              const visibleChildren = item.children?.filter((child) => canSeeItem(child, userRole)) ?? [];
              const active = item.href ? isActivePath(pathname, item) : false;
              const expanded = active || visibleChildren.some((child) => isActivePath(pathname, child));
              const linkClassName = active || expanded ? "is-active" : undefined;
              const isPersonalSection = item.href.endsWith("/dashboard");

              return (
                <div className="proto-admin-nav-group" key={item.href || item.label}>
                  {isPersonalSection && index > 0 ? (
                    <span className="proto-admin-nav-section">{t(locale, "个人", "Personal")}</span>
                  ) : null}
                  {item.href ? (
                    <Link className={linkClassName} href={item.href} onClick={() => setIsMenuOpen(false)}>
                      <span aria-hidden="true">{item.icon}</span>
                      {item.label}
                    </Link>
                  ) : (
                    <span className="proto-admin-nav-disabled">
                      <span aria-hidden="true">{item.icon}</span>
                      {item.label}
                    </span>
                  )}
                  {expanded && visibleChildren.length > 0 ? (
                    <div className="proto-admin-subnav">
                      {visibleChildren.map((child) => (
                        <Link
                          className={isActivePath(pathname, child) ? "is-active" : undefined}
                          href={child.href}
                          key={child.href}
                          onClick={() => setIsMenuOpen(false)}
                        >
                          <span aria-hidden="true">{child.icon}</span>
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>
        </aside>

        <div className="proto-admin-main">{children}</div>
      </section>
    </div>
  );
}
