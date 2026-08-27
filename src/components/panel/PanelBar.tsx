import Link from "next/link";
import { esPanel } from "@/i18n/es";
import { roleLabel, type UserRole } from "@/lib/auth/roles";
import { logoutAction } from "@/lib/auth/actions";

export interface PanelTab {
  href: string;
  label: string;
  count?: number;
  active?: boolean;
  /**
   * Which row the tab belongs to. `"main"` (the default) is the daily work —
   * the screens an operator opens because something arrived. `"manage"` is
   * setup: the records you edit when something changes, not every day.
   *
   * /admin reached eight tabs, which is past what fits one row on a phone and
   * reads as a wall rather than a menu. Splitting them costs one line per tab
   * and no new route; appending a ninth to a flat row would not have.
   */
  group?: "main" | "manage";
}

/**
 * Shared panel sub-header: title, the signed-in user's role, a logout form, and
 * a tab row. Server component — the logout button posts to the logout action,
 * so the panel needs no client JS.
 */
export function PanelBar({
  title,
  role,
  userName,
  tabs,
}: {
  title: string;
  role: UserRole;
  userName: string | null;
  tabs: PanelTab[];
}) {
  const manage = tabs.filter((t) => t.group === "manage");

  return (
    <div className="panel-bar">
      <div className="panel-bar__inner">
        <div className="panel-bar__top">
          <h1 className="panel-bar__title">{title}</h1>
          <div className="panel-bar__who">
            {userName ? <span>{userName}</span> : null}
            <span className="panel-bar__role">{roleLabel(role)}</span>
            <form action={logoutAction}>
              <button className="panel-btn" type="submit">
                {esPanel.logout}
              </button>
            </form>
          </div>
        </div>
        <nav className="panel-tabs" aria-label={esPanel.navMain}>
          {tabs
            .filter((t) => (t.group ?? "main") === "main")
            .map((t) => (
              <PanelTabLink key={t.href} tab={t} />
            ))}
        </nav>
        {manage.length > 0 ? (
          /* A second row rather than a disclosure: a panel with no client JS
             cannot restore an open/closed state, and a menu that hides where
             you are is worse than one that is merely quieter. */
          <nav className="panel-tabs panel-tabs--manage" aria-label={esPanel.navManage}>
            <span className="panel-tabs__label">{esPanel.navManage}</span>
            {manage.map((t) => (
              <PanelTabLink key={t.href} tab={t} />
            ))}
          </nav>
        ) : null}
      </div>
    </div>
  );
}

function PanelTabLink({ tab }: { tab: PanelTab }) {
  return (
    <Link
      href={tab.href}
      className={`panel-tab${tab.active ? " panel-tab--active" : ""}`}
      aria-current={tab.active ? "page" : undefined}
    >
      {tab.label}
      {tab.count ? <span className="panel-tab__count">{tab.count}</span> : null}
    </Link>
  );
}
