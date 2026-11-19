import {
  Activity01Icon, Add01Icon, AlertCircleIcon, AlertDiamondIcon, ArrowDataTransferHorizontalIcon, ArrowDown01Icon,
  ArrowRight01Icon, BankIcon, BookOpen01Icon, Cancel01Icon, CheckmarkCircle02Icon, Clock01Icon, Csv01Icon,
  Database01Icon, Flag02Icon, Invoice01Icon, Maximize01Icon, Pdf01Icon, Radar01Icon, RulerIcon, SearchList01Icon,
  SidebarLeftIcon, SlidersHorizontalIcon, Target02Icon, Task01Icon, Tick02Icon, Upload04Icon, UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import type { ReactElement } from "react";

/** Explicit map keeps the bundle to the icons we use. Keys match the names used in domain metadata. */
const ICONS = {
  "activity-01": Activity01Icon, "add-01": Add01Icon, "alert-circle": AlertCircleIcon, "alert-diamond": AlertDiamondIcon,
  "arrow-data-transfer-horizontal": ArrowDataTransferHorizontalIcon, "arrow-down-01": ArrowDown01Icon, "arrow-right-01": ArrowRight01Icon,
  bank: BankIcon, "book-open-01": BookOpen01Icon, "cancel-01": Cancel01Icon, "checkmark-circle-02": CheckmarkCircle02Icon,
  "clock-01": Clock01Icon, "csv-01": Csv01Icon, "database-01": Database01Icon, "flag-02": Flag02Icon, "invoice-01": Invoice01Icon,
  "maximize-01": Maximize01Icon, "pdf-01": Pdf01Icon, "radar-01": Radar01Icon, ruler: RulerIcon, "search-list-01": SearchList01Icon,
  "sidebar-left": SidebarLeftIcon, "sliders-horizontal": SlidersHorizontalIcon, "target-02": Target02Icon, "task-01": Task01Icon,
  "tick-02": Tick02Icon, "upload-04": Upload04Icon, "user-group": UserGroupIcon,
} satisfies Record<string, IconSvgElement>;

export type IconName = keyof typeof ICONS;

const isIconName = (name: string): name is IconName => name in ICONS;

/** Size comes from CSS (--icon on .hi), so one class controls every icon. */
export function Icon({ name, className = "" }: { name: string; className?: string }): ReactElement | null {
  if (!isIconName(name)) return null;
  return <HugeiconsIcon icon={ICONS[name]} size={16} strokeWidth={1.6} className={`hi ${className}`.trim()} aria-hidden />;
}

/** FinGuard mark: shield with a ledger-line F. Same geometry as public/logo.svg and the favicon. */
export function BrandMark(): ReactElement {
  return (
    <svg className="brand-mark" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2.5 19.4 5.1Q20 5.3 20 5.9V11.5C20 16.4 16.6 19.9 12 21.8 7.4 19.9 4 16.4 4 11.5V5.9Q4 5.3 4.6 5.1Z" fill="currentColor" />
      <path d="M15 7.6H9.6V16.4M9.6 11.8H13.6" fill="none" stroke="var(--cream)" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
