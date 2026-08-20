import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  TrendingUp,
  Truck,
  FileText,
  Users,
  UserCog,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Package,
  Ship,
  DollarSign,
  BarChart3,
  ShieldCheck,
  Activity,
  Building2,
  Tent,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { BrandLogo } from '@/components/BrandLogo';
import { useLayout } from '@/components/layout/useLayout';
import { useUserRole, type UserProfile } from '@/hooks/useUserRole';
import { FAIR_APP_HOME } from '@/lib/fair-origins';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  {
    path: FAIR_APP_HOME,
    icon: Tent,
    label: 'Feira',
    external: true,
    roles: ['admin', 'financeiro', 'operacional'] as UserProfile[],
  },
  {
    path: '/comercial',
    icon: TrendingUp,
    label: 'Comercial',
    roles: ['admin', 'financeiro', 'operacional'] as UserProfile[],
  },
  {
    path: '/operacional',
    icon: Truck,
    label: 'Operação',
    roles: ['admin', 'financeiro', 'operacional'] as UserProfile[],
  },
  { path: '/documentos', icon: FileText, label: 'Documentos' },
  { path: '/relatorios', icon: BarChart3, label: 'Relatórios' },
  {
    path: '/monitoramento-seguros',
    icon: Activity,
    label: 'Monit. Seguros',
    roles: ['admin', 'financeiro', 'operacional'] as UserProfile[],
  },
  { path: '/clientes', icon: Users, label: 'Clientes' },
  { path: '/embarcadores', icon: Ship, label: 'Embarcadores' },
  { path: '/veiculos', icon: Truck, label: 'Veículos' },
  {
    path: '/tabelas-preco',
    icon: Package,
    label: 'Tabelas de Preço',
    roles: ['admin', 'operacional', 'financeiro'] as UserProfile[],
  },
  {
    path: '/financeiro',
    icon: DollarSign,
    label: 'Financeiro',
    roles: ['admin', 'financeiro', 'operacional'] as UserProfile[],
  },
  {
    path: '/aprovacoes',
    icon: ShieldCheck,
    label: 'Aprovações',
    roles: ['admin', 'financeiro'] as UserProfile[],
  },
  {
    path: '/usuarios',
    icon: UserCog,
    label: 'Usuários',
    roles: ['admin'] as UserProfile[],
  },
  {
    path: '/configuracoes-empresa',
    icon: Building2,
    label: 'Empresa',
    roles: ['admin'] as UserProfile[],
  },
];

type NavItem = {
  path: string;
  icon: typeof LayoutDashboard;
  label: string;
  roles?: UserProfile[];
  external?: boolean;
};
const bottomNavItems: NavItem[] = [
  // { path: '/configuracoes', icon: Settings, label: 'Configurações' }, // (a implementar)
  // { path: '/integracoes', icon: Plug, label: 'Integrações' }, // (a implementar)
  // { path: '/ajuda', icon: HelpCircle, label: 'Ajuda' }, // (a implementar)
];

export function Sidebar() {
  const { isSidebarCollapsed: isCollapsed, toggleSidebar } = useLayout();
  const { perfil } = useUserRole();
  const filteredNavItems = navItems.filter(
    (item) => !item.roles || (perfil != null && item.roles?.includes(perfil))
  );

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 72 : 256 }}
      transition={{ duration: 0.2, ease: [0.22, 0.9, 0.32, 1] }}
      className="fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border flex flex-col"
      data-testid="sidebar"
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-sidebar-border">
        <motion.div
          className="w-full"
          animate={{ display: 'flex', justifyContent: isCollapsed ? 'center' : 'flex-start' }}
        >
          <AnimatePresence initial={false}>
            {isCollapsed ? (
              <BrandLogo key="logo-collapsed" withText={false} />
            ) : (
              <motion.div
                key="logo-expanded"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
                <BrandLogo withText />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {filteredNavItems.map((item) => (
          <NavItem
            key={item.path}
            path={item.path}
            icon={item.icon}
            label={item.label}
            isCollapsed={isCollapsed}
            external={item.external === true}
            isActive={false}
          />
        ))}
      </nav>

      {/* Bottom Navigation */}
      <div className="py-4 px-3 border-t border-sidebar-border space-y-1">
        {bottomNavItems.map((item) => (
          <NavItem
            key={item.path}
            {...item}
            isCollapsed={isCollapsed}
            isActive={location.pathname === item.path}
          />
        ))}

        {/* Logout Button */}
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                'w-full justify-start gap-3 text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent',
                isCollapsed && 'justify-center px-2'
              )}
            >
              <LogOut className="w-5 h-5 shrink-0" />
              {!isCollapsed && <span>Sair</span>}
            </Button>
          </TooltipTrigger>
          {isCollapsed && <TooltipContent side="right">Sair</TooltipContent>}
        </Tooltip>
      </div>

      {/* Collapse Toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-sidebar border border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent shadow-md"
        data-testid="sidebar-toggle"
        aria-label={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
      >
        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </Button>
    </motion.aside>
  );
}

interface NavItemProps {
  path: string;
  icon: React.ElementType;
  label: string;
  isCollapsed: boolean;
  isActive: boolean;
  external?: boolean;
}

function NavItem({ path, icon: Icon, label, isCollapsed, isActive, external }: NavItemProps) {
  const inner = (
    <motion.div
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors relative',
        'text-sidebar-muted hover:text-sidebar-foreground',
        isActive && 'bg-sidebar-accent text-sidebar-foreground',
        isCollapsed && 'justify-center px-2'
      )}
      whileHover={{ x: isCollapsed ? 0 : 4 }}
      transition={{ duration: 0.15 }}
    >
      {isActive && (
        <motion.div
          layoutId="activeIndicator"
          className="absolute left-0 w-1 h-6 bg-sidebar-primary rounded-r-full"
          initial={false}
          transition={{ duration: 0.2, ease: [0.22, 0.9, 0.32, 1] }}
        />
      )}
      <Icon className="w-5 h-5 shrink-0" />
      <AnimatePresence>
        {!isCollapsed && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="font-medium"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        {external ? (
          <a href={path} rel="noreferrer">
            {inner}
          </a>
        ) : (
          <NavLink to={path}>{inner}</NavLink>
        )}
      </TooltipTrigger>
      {isCollapsed && <TooltipContent side="right">{label}</TooltipContent>}
    </Tooltip>
  );
}
