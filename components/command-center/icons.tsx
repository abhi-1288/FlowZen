import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Banknote,
  Briefcase,
  Calendar,
  Check,
  CheckSquare,
  Clock,
  FileText,
  Inbox,
  Key,
  List,
  Plus,
  Shield,
  Target,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  activity: Activity,
  alert: AlertTriangle,
  "arrow-down": ArrowDown,
  "arrow-up": ArrowUp,
  banknote: Banknote,
  briefcase: Briefcase,
  calendar: Calendar,
  check: Check,
  "check-square": CheckSquare,
  clock: Clock,
  file: FileText,
  inbox: Inbox,
  key: Key,
  list: List,
  plus: Plus,
  shield: Shield,
  target: Target,
  trending: TrendingUp,
  "user-plus": UserPlus,
  users: Users,
  wallet: Wallet,
  wrench: Wrench,
};

export function CommandIcon({
  name,
  size = 18,
  className,
}: {
  name?: string;
  size?: number;
  className?: string;
}) {
  const Component = (name && ICONS[name]) || Activity;
  return <Component size={size} className={className} />;
}